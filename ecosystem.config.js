module.exports = {
  apps : [{
    "name": "mnp_lookup_app2",
    "script": "./bin/www",
    "node_args": "--max_old_space_size=1024",
    "instances": "max",
  }]
};
