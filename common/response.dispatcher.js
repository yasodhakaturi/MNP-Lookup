const _ = require('lodash');
const axios = require('axios');
const qs = require('qs');
var ENV = require('./config')
const processed_data_model = require('../models/processed_data_model');
const response_data_model = require('../models/response_data_model');
const requested_data_model = require('../models/requested_data_model');


const dispatcherService = (job, mnp_data)=>{
  let mnpDataAsMobileKeys = _.mapKeys(mnp_data, (mnp) => {
    return mnp.msisdn
  });
  if(job.receive_batch_ids){

     // map mobile number of each batch and the data received in responsedata_model for the job received
    _.each(job.receive_batch_ids, (batch)=>{
      requested_data_model.findByBatchStatus(batch, 'inprogress').then((reqRow)=>{
        let all_numbers = reqRow.requested_data.split(',');
        let filteredMnpData = _.values(_.filter(mnpDataAsMobileKeys, (mnpRow, mobi)=>{
          return _.includes(all_numbers, mobi);
        }));

        if(filteredMnpData.length > 0){
          let url = reqRow.hook_url;
          const data = {batch_id: batch, results: filteredMnpData};
          const options = {
            method: 'post',
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            data: data,
            url:url
          };
          axios(options).then(function (response) {
            reqRow.dispatched_count = ((reqRow.dispatched_count || 0) + filteredMnpData.length);
            if(reqRow.dispatched_count < reqRow.received_count){
              reqRow.status = "partial"
            }else if(reqRow.dispatched_count == reqRow.received_count){
              reqRow.status = "completed"
            }
            reqRow.save().then(()=>{
              console.log(`Resquests ${batch} status updated`)
            });
            console.log(`Dispatched ${batch} with ${filteredMnpData.length} numbers`)
          }).catch(function (err) {
            console.log('Failed Dispatch Request', err)
          });
        }

      }).catch((err)=>{
        console.log("Failed to fetch batch row", err)
      })
    })

  }

}

exports.dispatcherService = dispatcherService;
