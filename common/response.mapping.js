const _ = require('lodash');
const mnp_response_model = require('../models/response_data_model');

class ResponseSchema{
  constructor(res) {
    this.msisdn = _.get(res, ['to'], "");
    this.mccmnc = _.get(res, ['mccMnc'], "");
    this.mcc = this.mccmnc.substr(0,3);
    this.mnc = this.mccmnc.substr( -2);
    this.imsi = _.get(res, ['imsi'], "");

    this.subscribercode = _.get(res, ['status','groupName'], "");
    this.subscriberstatus = _.get(res, ['status','name'], "");
    this.originalnetworkname = _.get(res, ['originalNetwork','networkName'], "");
    this.orignalcountryname = _.get(res, ['originalNetwork','countryName'], "");
    this.orignalcountryprefix = _.get(res, ['originalNetwork','countryPrefix'], "");
    this.orignalnetworkprefix = _.get(res, ['originalNetwork','networkPrefix'], "");

    this.isported = _.get(res, ['ported'], "");
    this.isroaming = _.get(res, ['roaming'], "");
    this.isvalid = _.get(res, ['error','groupId'], "");
    this.errorcode = _.get(res, ['error','groupName'], "");
    this.errorstatus = _.get(res, ['error','name'], "");
  }
}

const saveMapping = (results, job) => {
  return new Promise((resolve, reject) => {
    if (results && results.length > 0) {
      let allRows = [];
      _.each(results, (row) => {
        let mappedRow = new ResponseSchema(row);

        allRows.push({
          mobile_number: mappedRow.msisdn,
          mnp_data: mappedRow,
          job_id: (job ? job._id : ''),
          status: 'new'
        });
      });
      mnp_response_model.model.insertMany(allRows).then((rows) => {
        if (rows.length && job) {
          job.status = 'received';
          job.save().catch((err) => {
            console.log("Failed to save Job status", job)
          });
        }

      }).catch((err) => {
        console.log("Failed to save mnp responses", allRows)
      });

      resolve(_.map(allRows, 'mnp_data'));

    } else {
      resolve([])
    }
  });
}

exports.saveMapping = saveMapping;
