const cron = require("node-cron")
const mongoose = require('./../../common/services/mongoose.service').mongoose
const requesteddata_model = require('../../models/requested_data_model');
const processeddata_model = require('../../models/processed_data_model');
const _ = require('lodash')


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

