const _ = require('lodash');
const axios = require('axios');
const qs = require('qs');
var ENV = require('./config')
const processeddata_model = require('../models/processed_data_model');
const mnpMapping =  require('../common/response.mapping');
const doAsyncRequest = (payload) => {
  console.log('doMnpProviderRequest', payload)
  return new Promise((resolve, reject) => {
    let url = `${ENV.INFOBIP_API_ASYNC_URL}`;
    let web_hook = `${ENV.endpoint}${ENV.WEB_HOOK_PATH}/${payload._id}`;

    // const data = qs.stringify({"to":payload.req_payload.join(','),"notifyContentType":"string","notifyUrl":web_hook});
    const data = {"to":payload.req_payload.join(','),"notifyContentType":"string","notifyUrl":web_hook};

    const options = {
      method: 'post',
      headers: {
        "Authorization": `${ENV.INFOBIP_API_KEY}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      data: data,
      url:url
    };

    console.log('doMnpProviderRequest Trigger', options)
    axios(options).then(function (response) {
      resolve(response);
    }).catch(function (err) {
      console.log('doMnpProviderRequest Request Failed', err)
      reject(err);
    });
  })
}

const doSyncRequest = (number) => {
  console.log('doMnpProviderRequest', number)
  return new Promise((resolve, reject) => {
    let url = `${ENV.INFOBIP_API_ASYNC_URL}`;

    // const data = qs.stringify({"to":payload.req_payload.join(','),"notifyContentType":"string","notifyUrl":web_hook});
    const data = {"to":[number],"notifyContentType":"string"};

    const options = {
      method: 'post',
      headers: {
        "Authorization": `${ENV.INFOBIP_API_KEY}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      data: data,
      url:url
    };

    console.log('doMnpProviderRequest Trigger', options);


    axios(options).then(function (response) {
      //
      // _.each(response.data.results, (row)=>{
      //     row.status = 'inprogress';
      //     row.save().then((savedRow)=>{
      //       console.log('Fetcher Data row Status Updated', savedRow)
      //     }).catch((err)=>{
      //       console.log(err);
      //     });
      //   });

        if(response.data.results && response.data.results.length > 0){
          mnpMapping.saveMapping(response.data.results).then((mappedRows)=>{
            resolve(mappedRows)
          }).catch((e)=>{
            reject(e);
          });

        }else{
          reject({error: "No Results Found"})
        }
    }).catch(function (err) {
      console.log('doMnpProviderRequest Request Failed', err)
      reject(err);
    });
  })
}

exports.doAsyncMnpRequest = doAsyncRequest;
exports.doSyncMnpRequest = doSyncRequest;
