module.exports = {
  apps : [{
    "name": "mnp_lookup_app",
    "script": "./bin/www",
    "node_args": ["--max_old_space_size=500"],
    "max_memory_restart": "480"
  }]
};
