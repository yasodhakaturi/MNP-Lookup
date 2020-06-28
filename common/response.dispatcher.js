const _ = require('lodash');
const axios = require('axios');
const qs = require('qs');
var ENV = require('./config')
const processed_data_model = require('../models/processed_data_model');

const requested_data_model = require('../models/requested_data_model');


const dispatcherService = (job, mnp_data)=>{
  let mnpDataAsMobileKeys = _.mapKeys(mnp_data, (mnp) => {
    return mnp.get ? mnp.get('mobile_number') : mnp.mobile_number
  });
  if(job.receive_batch_ids){

     // map mobile number of each batch and the data received in responsedata_model for the job received
    _.each(job.receive_batch_ids, (batch)=>{
      requested_data_model.findByBatchStatus(batch, 'inprogress|partial').then((reqRow)=> {
        if (reqRow) {
          let all_numbers = reqRow.requested_data.split(',');
          let filteredMnpData = _.values(_.filter(mnpDataAsMobileKeys, (mnpRow, mobi) => {
            return _.includes(all_numbers, mobi);
          }));

          if (filteredMnpData.length > 0) {
            let url = reqRow.hook_url;
            const data = {
              batch_id: batch,
              results: _.map(filteredMnpData, _.partialRight(_.pick, ['mobile_number', "mnp_data"]))
            };
            const options = {
              method: 'post',
              headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
              },
              data: data,
              url: url
            };

            let onSucessProcess = () => {

              let dispatched_count = ((reqRow.dispatched_count || 0) + filteredMnpData.length);
              requested_data_model.model.updateOne(
                { _id: reqRow._id },
                { $inc: { dispatched_count: filteredMnpData.length },
                  "status": ((dispatched_count == reqRow.received_count) ? 'completed' : 'partial'),
                  "completed_on": new Date()},
                function(err, doc){
                  if(err){
                    console.log(`Requests ${batch} status failed to update`, reqRow.dispatched_count, err)
                  }else{
                    console.log(`Requests ${batch} status updated`, reqRow.dispatched_count, doc)
                  }
                }
              )

              // reqRow.dispatched_count = ((reqRow.dispatched_count || 0) + filteredMnpData.length);
              // if (reqRow.dispatched_count < reqRow.received_count) {
              //   reqRow.status = "partial"
              // } else if (reqRow.dispatched_count == reqRow.received_count) {
              //   reqRow.status = "completed"
              // }
              // reqRow.save().then(() => {
              //   console.log(`Requests ${batch} status updated`, reqRow.dispatched_count)
              // }).catch((e)=>{
              //   console.log(`Requests ${batch} status failed to update`, reqRow.dispatched_count)
              // });
              console.log(`Dispatched ${batch} with ${filteredMnpData.length} numbers`, reqRow.dispatched_count);

              processed_data_model.model.updateMany({"mobile_number": {$in: _.map(filteredMnpData, 'mobile_number')}, job_id: job._id}, {"$set":{"status": 'completed'}},
                function(error, docs) {
                  if(error){
                    console.log('processed queue row status', _.map(filteredMnpData, 'mobile_number'), docs);
                  }
                  console.log('processed queue row status', _.map(filteredMnpData, 'mobile_number'), docs);
                });
              // _.each(filteredMnpData, (mnp_data) => {
              //   processed_data_model.model.findOne({
              //     "mobile_number": mnp_data.mobile_number,
              //     job_id: job._id
              //   }).then((prow) => {
              //     if (prow) {
              //       prow.status = "completed"
              //       prow.save().then(() => {
              //         console.log('processed queue row status');
              //       })
              //     }
              //
              //   });
              // })
            };


            if (reqRow.ignore_web_hook) {
              console.log('------- ignore web hook request---------')
              console.log(JSON.stringify(options))
              onSucessProcess()
            } else {
              axios(options).then(function (response) {
                onSucessProcess()
              }).catch(function (err) {
                console.log('Failed Dispatch Request', err)
              });
            }
          }
      }else{
          console.log('cannot find batch record', batch)
        }
      }).catch((err)=>{
        console.error("Failed to fetch batch row", err)
      })
    })

  }

}

exports.dispatcherService = dispatcherService;
