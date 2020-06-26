module.exports = {
  apps : [{
    "name": "mnp_lookup_app",
    "script": "./bin/www",
    "node_args": ["--max_old_space_size=1020"],
    "instances": 1
  }]
};
