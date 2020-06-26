module.exports = {
  apps : [{
    "name": "mnp_lookup_app",
    "script": "./bin/www",
    "node_args": ["--harmony", "--max_old_space_size=500"],
    "instances": "max",
    "exec_mode": "cluster",
    "max_memory_restart": "480"
  }]
};
