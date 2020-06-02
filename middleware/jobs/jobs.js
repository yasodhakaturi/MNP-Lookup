const cron = require("node-cron")
var ENV = require('./../../common/config');
const mongoose = require('./../../common/services/mongoose.service').mongoose
const requesteddata_model = require('../../models/requested_data_model');
const processeddata_model = require('../../models/processed_data_model');
const mnp_requests_model = require('../../models/mnp_requests_model');

const mnpMapping =  require('../../common/response.mapping');
const providerRequestor =  require('../../common/provider.requests');

const _ = require('lodash');



exports.requestedDataToQueue = (status, res) => {
    return new Promise((resolve, reject) => {
        requesteddata_model.findByStatus(status)
        .then((result) => {

        let mobile_id_pairs = [];
        _.each(result, (row)=>{
            _.each(row.requested_data.split(','), (mobile) => {
                mobile_id_pairs.push(new processeddata_model.model({
                    'batch_id': row._id,
                    'mobile_number': mobile,
                    'web_hook': row.hook_url,
                    'status': 'new_request'
                }));
            })
        });
        if(mobile_id_pairs.length){
            processeddata_model.model.insertMany(mobile_id_pairs, function(error, docs) {
                if(error){
                    reject(error);
                }
                _.each(result, (row)=>{
                    // requesteddata_model.updateStatus(doc.batch_id, 'inprogress')
                    row.status = 'inprogress';
                    row.save();
                })
                resolve(docs);
            });
        }else{
            resolve([])
        }


        }).catch((err)=>{
            reject(err)
        });
    })
};

exports.requestedQueueToFetcher = (status, limit, res) => {
    console.log('-------Fetcher Job Triggered-------')
    return new Promise((resolve, reject) => {
        processeddata_model.findByStatusWithLimit(status, limit)
          .then((results) => {

              if(results.length > 0){
                  // we get bunch of records.
                  console.log('-------Fetcher Data Received-------', results)
                  let fetcherJob = {};

                  fetcherJob.req_ids = _.map(results, (r)=>{return r._id;});
                  fetcherJob.req_payload = _.map(results,(r)=>{
                      return r.mobile_number;
                  });
                  fetcherJob.receive_batch_ids = _.uniqBy(_.map(results,(r)=>{return r.batch_id}), (b)=>{return b.toString()});
                  fetcherJob.status = 'new';

                  fetcherJob = new mnp_requests_model.model(fetcherJob);
                  console.log('-------Fetcher Data model-------', fetcherJob)
                  fetcherJob.save().then((doc)=>{

                      console.log('fetcherJob save', doc)
                      // request a Service API.
                      if(!doc.req_payload || doc.req_payload.length == 0){
                          reject({"error": "No payload"});
                      }else{
                          providerRequestor.doAsyncMnpRequest(doc).then((res)=>{
                              _.each(results, (row)=>{
                                  row.status = 'inprogress';
                                  row.job_id = doc._id;
                                  row.save().then((savedRow)=>{
                                      console.log('Fetcher Data row Status Updated', savedRow)
                                  }).catch((err)=>{
                                      console.log(err);
                                  });
                              });

                              fetcherJob.response = {
                                  status: res.status,
                                  response: JSON.stringify({raw: res.data}),
                                  bulk_id: res.data.bulkId || "",
                                  received_on:Date.now()
                              };
                              fetcherJob.bulk_id = fetcherJob.response.bulk_id;

                              fetcherJob.save().catch((saveerr)=>{
                                  console.log("Failed to save response",saveerr)
                              });


                              if(res.data.results && res.data.results.length > 0){
                                  mnpMapping.saveMapping(res.data.results, doc)
                              }

                          }).catch((err)=>{

                              fetcherJob.response = {
                                status: err.response.status,
                                response: JSON.stringify({raw: err.response.data || err.response.statusText}),
                                received_on:Date.now()
                              };

                              fetcherJob.save().catch((saveerr)=>{
                                  console.log("Failed to save response",saveerr)
                              });

                              reject(err);
                          });
                      }

                  }).catch((error)=>{
                      if(error){
                          console.log(error)
                          reject(error);
                      }
                  })
                  // mnp_requests_model.model.insert(fetcherJob, function(error, doc) {
                  //     if(error){
                  //         reject(error);
                  //     }
                  //     console.log(doc)
                  //     // _.each(results, (row)=>{
                  //     //     // requesteddata_model.updateStatus(doc.batch_id, 'inprogress')
                  //     //     row.status = 'inprogress';
                  //     //     row.save();
                  //     // })
                  //
                  // })

              }else{
                  resolve([])
              }

          }).catch((err)=>{
            reject(err)
        });
    })
};
