const cron = require("node-cron")
var ENV = require('./../../common/config');
const mongoose = require('./../../common/services/mongoose.service').mongoose
const requesteddata_model = require('../../models/requested_data_model');
const processeddata_model = require('../../models/processed_data_model');
const mnp_requests_model = require('../../models/mnp_requests_model');
const response_data_model = require('../../models/response_data_model');

const mnpMapping =  require('../../common/response.mapping');
const providerRequestor =  require('../../common/provider.requests');
const dispatcher = require('../../common/response.dispatcher');
const _ = require('lodash');

let getMnpCheckup = (allMobileNumbers)=>{
    return new Promise((resolve, reject) => {
    let promises = [];
    let found_numbers = [];
    let missed_numbers = [];
    _.each(_.chunk(allMobileNumbers, 20), (chunk)=>{
        let promise = response_data_model.getMNPBYMobileNumber(chunk);
        promises.push(promise)
        promise.then((mnpData)=>{
            let found_mobile_numbers = [];
            if(mnpData.length > 0){
                found_mobile_numbers = _.map(mnpData, 'mobile_number');
            }
            let missed_mobile_numbers = _.without(chunk, ...found_mobile_numbers);
            found_numbers = _.concat(found_numbers, mnpData);
            missed_numbers = _.concat(missed_numbers, missed_mobile_numbers);
        });
    });

    Promise.all(promises)
      .then((results) => {
          // console.log("All done getMnpCheckup", {available: found_numbers,not_available: missed_numbers}, allMobileNumbers);
          resolve({available: found_numbers,not_available: missed_numbers})
      })
      .catch((e) => {
          console.log('error in getMnpCheckup', e)
          reject(e);
          // Handle errors here
      });
    });
}

let getMobileIdPairs = (result) => {
    return new Promise((resolve, reject) => {
        let mobile_id_pairs = [];
        let promises = [];
        _.each(result, (row)=>{
            let alldata = row.requested_data.split(',');
            let allMobileNumbers = _.uniq(alldata);
            console.log("Filter data by uniqueness", alldata.length, allMobileNumbers.length)
            let promise = getMnpCheckup(allMobileNumbers);
            promises.push(promise);

            //find all the mnp data for all the mobile numbers in the DB,
            // change status to in-progress found mobile numbers and rest as new request
            // once saved to DB trigger the webhook based on found data length > 0.

            promise.then((checkMobileNumbers) => {
                // add to mobile for new mobile numbers;
                // console.log(checkMobileNumbers.available);
                // create a job;
                let availableNumbers = []
                _.each(checkMobileNumbers.available, (mobile) => {
                    availableNumbers.push(new processeddata_model.model({
                        'batch_id': row._id,
                        'mobile_number': mobile.mobile_number,
                        'web_hook': row.hook_url,
                        'status': 'inprogress'
                    }));
                })

                if(availableNumbers.length > 0) {
                    processeddata_model.model.insertMany(availableNumbers, function (error, docs) {
                        if (error) {
                            reject(error);
                        }
                        if(row.status == 'new_request'){
                            row.status = 'inprogress';
                            row.save();
                        }

                        let fetcherJob = {};

                        fetcherJob.req_ids = _.map(docs, (r) => {
                            return r._id;
                        });

                        fetcherJob.req_payload = _.map(docs, (r) => {
                            return r.mobile_number;
                        });

                        fetcherJob.receive_batch_ids = _.uniqBy(_.map(docs, (r) => {
                            return r.batch_id
                        }), (b) => {
                            return b.toString()
                        });

                        fetcherJob.status = 'available';

                        fetcherJob = new mnp_requests_model.model(fetcherJob);
                        // console.log('-------Fetcher Data model-------', fetcherJob)
                        fetcherJob.save().then((job) => {
                            dispatcher.dispatcherService(job, checkMobileNumbers.available);
                        })
                    });

                }

                // add to mobile id pairs for new mobile numbers;
                _.each(checkMobileNumbers.not_available, (mobile) => {
                    mobile_id_pairs.push(new processeddata_model.model({
                        'batch_id': row._id,
                        'mobile_number': mobile,
                        'web_hook': row.hook_url,
                        'status': 'new_request'
                    }));
                })
            }, (e) => {
                console.log('error in getMobileIdPairs', e)
                reject(e);
            })

            // one approach is by taking chunks of data
            // find each chunk of mobiles numbers in DB using $in
            // separate found and notfound mobile numbers

            // to use dispatcher service we need a job id, so lets create sample job with status 'requested'.
            // create a dispatcher service for found mobile numbers
            //dispatcher.dispatcherService(job, allRows)


            // create job for non available numbers.


        });

        Promise.all(promises)
          .then((results) => {
              // console.log("All done", results);
              resolve(mobile_id_pairs)
          })
          .catch((e) => {
              // Handle errors here
              console.log('error in mobile_id_pairs getMobileIdPairs', e)
              reject(e);
          });
    });
}

let doBatchRequest = (job) => {
    return new Promise((resolve, reject) => {
        providerRequestor.doAsyncMnpRequest(job).then((res) => {


            try {
                job.response = {
                    status: res.status,
                    response: JSON.stringify({raw: res.data || ""}),
                    mobile_numbers: _.map((res.data && res.data.results) || [] , 'to'),
                    bulk_id: (res.data && res.data.bulkId) || "",
                    received_on: Date.now()
                };
                job.bulk_id = job.response.bulk_id;
                job.status = "requested";
            } catch (e) {
                job.response = "{raw: 'error response'}";
                job.status = "failed";
            }
            job.save().then(() => {
                if (res.data.results && res.data.results.length > 0) {
                    mnpMapping.saveMapping(res.data.results, job).then((allRows) => {
                        dispatcher.dispatcherService(job, allRows)
                        resolve(allRows);
                    }).catch((err) => {
                        reject(err);
                    })
                } else {
                    resolve([])
                }
            }).catch((saveerr) => {

                console.log("Failed to save response in fetcherJob", saveerr);
                if (res.data.results && res.data.results.length > 0) {
                    mnpMapping.saveMapping(res.data.results, job).then((allRows) => {
                        dispatcher.dispatcherService(job, allRows)
                        resolve(allRows);
                    }).catch((err) => {
                        reject(err);
                    })
                } else {
                    resolve([])
                }
            });

        }).catch((err) => {

            try {
                job.response = {
                    status: _.get(err, ['response', 'status'], err.toString() || "failed with error"),
                    response: JSON.stringify({raw: _.get(err, ['response', 'data'], _.get(err, ['response', 'statusText'], "some error"))}),
                    received_on: Date.now()
                };

                job.status = "failed";

                job.save().catch((saveerr) => {
                    console.log("Failed to save response", saveerr)
                });
                reject(err);
            } catch (e) {
                job.status = "failed";
                job.save();

                reject(err);
            }

        });
    })
}

exports.requestedDataToQueue = (status, res) => {
    return new Promise((resolve, reject) => {
        requesteddata_model.findByStatus(status)
        .then((result) => {
            getMobileIdPairs(result).then((mobile_id_pairs)=>{
                if(mobile_id_pairs.length){
                    processeddata_model.model.insertMany(mobile_id_pairs, function(error, docs) {
                        if(error){
                            reject(error);
                        }
                        // _.each(result, (row)=>{
                        //     if(row.status == 'new_request'){
                        //         row.status = 'inprogress';
                        //         row.save();
                        //     }
                        // })
                        requesteddata_model.model.updateMany({"_id": {$in: _.map(result, '_id')}, status: 'new_request'}, {"$set":{"status": 'inprogress'}},
                          function(error, docs) {
                              if(error){
                                  console.log("failed to update status", _.map(result, '_id'), error)
                              }
                              console.log("update status", _.map(result, '_id'), docs)
                          });
                        resolve(docs);
                    });
                }else{
                    resolve([])
                }
            })
        }).catch((err)=>{
            reject(err)
        });
    })
};

exports.requestedQueueToFetcher = (status, limit, res) => {
    // console.log('-------Fetcher Job Triggered-------')
    return new Promise((resolve, reject) => {
        processeddata_model.findByStatusWithLimit(status, limit)
          .then((results) => {

              if(results.length > 0){
                  // we get bunch of records.
                  // console.log('-------Fetcher Data Received-------', results)
                  let fetcherJob = {};

                  fetcherJob.req_ids = _.map(results, (r)=>{return r._id;});
                  fetcherJob.req_payload = _.map(results,(r)=>{
                      return r.mobile_number;
                  });
                  fetcherJob.receive_batch_ids = _.uniqBy(_.map(results,(r)=>{return r.batch_id}), (b)=>{return b.toString()});
                  fetcherJob.status = 'new';

                  fetcherJob = new mnp_requests_model.model(fetcherJob);
                  // console.log('-------Fetcher Data model-------', fetcherJob)
                  fetcherJob.save().then((job)=>{

                      //console.log('fetcherJob save', job)
                      // request a Service API.
                      if(!job.req_payload || job.req_payload.length == 0){
                          reject({"error": "No payload"});
                      }else{
                          // _.each(results, (row)=>{
                          //     row.status = 'inprogress';
                          //     row.job_id = job._id;
                          //     row.save().then((savedRow)=>{
                          //         console.log('Fetcher Data row Status Updated', savedRow.mobile_number)
                          //     }).catch((err)=>{
                          //         console.log(err);
                          //     });
                          // });

                          processeddata_model.model.updateMany({"_id": {$in: _.map(results, '_id')}}, {"$set":{"status": 'inprogress', "job_id":job._id}},
                            function(error, docs) {
                                if(error){
                                    console.log(error);
                                }
                                console.log('Fetcher Data row Status Updated', _.map(results, 'mobile_number'), docs)
                            });
                          doBatchRequest(job).then((bRes)=>{
                              resolve(bRes);
                          }).catch((bErr)=>{
                              reject(bErr)
                          });
                      }

                  }).catch((error)=>{
                      if(error){
                          console.log(error)
                          reject(error);
                      }
                  })

              }else{
                  resolve([])
              }

          }).catch((err)=>{
            reject(err)
        });
    })
};

exports.doBatchRequestByStatus = (status, limit) => {
    return new Promise((resolve, reject) => {
        mnp_requests_model.findByStatus(status, limit).then((result) => {
            _.each(result, (job)=>{
                doBatchRequest(job)
            })
            resolve({});
        }).catch((err)=>{
            reject(err)
        });
    })


}
