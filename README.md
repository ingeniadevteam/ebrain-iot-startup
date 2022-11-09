# startup module


## Setup

Setup config files for each supported platform are placed in the **./setup** directory.

## Config

config/startup.json
```
{
  "init": "systemd",
  "enabled": true,
  "service_name": "myapp",
  "user": "pi",
  "group": "pi"
}
```
