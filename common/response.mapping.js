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

    let isvalid = _.get(res, ['error','groupId'], "") ;
    this.isvalid = isvalid == 0 ? ((_.get(res, ['status','groupName']) == "REJECTED") ? false : true)
                                : (isvalid == 1 ? false : !_.get(res, ['error','permanent']));

    this.errorcode = (!isvalid && (_.get(res, ['status','groupName']) == "REJECTED")) ? "HANDSET_ERRORS" : _.get(res, ['error','groupName'], "");
    this.errorstatus = (!isvalid && (_.get(res, ['status','groupName']) == "REJECTED")) ? "EC_OR_POTENTIALVERSIONINCOMPATIBILITY" : _.get(res, ['error','name'], "");
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
          job_id: (job ? job._id : undefined),
          status: 'new'
        });
      });
      mnp_response_model.model.insertMany(allRows, function(error, rows) {
        if(error){
          console.log("Failed to save mnp responses", allRows, error)
          reject(error);
        }
        if (rows.length && job) {
          job.status = 'received';
          job.save().catch((err) => {
            console.log("Failed to save Job status", job, err)
          });
        }
        resolve(rows);
      });

    } else {
      resolve([])
    }
  });
}

exports.saveMapping = saveMapping;
