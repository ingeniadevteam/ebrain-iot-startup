"use strict";

const { readFileSync, writeFileSync, existsSync } = require('fs');
const spawnSync = require('child_process').spawnSync;
const { platform } = require('os');


module.exports = async function (app) {
  const isLinux = platform() === 'linux';
  // load config
  let config;
  try {
    let configFile = readFileSync(`${app.configDir}/startup.json`).toString();
    if (!configFile) configFile = '{}';
    const configObject = JSON.parse(configFile);
    // validate
    app.startup.config = await require(`./validation`)(configObject);
    config = app.startup.config;
  } catch (error) {
    app.logger.error(`startup ${error.message}`);
    return;
  }

  // code for systemd
  if (config.init === "systemd") {
    // get the status of the service
    const service_file = `${config.service_name}.service`;
    let is_enabled = {};
    try {
      if (isLinux) {
        is_enabled = await spawnSync("systemctl", ["is-enabled", service_file]);
      }
    } catch (e) {
      throw e;
    }
    if (is_enabled.status === 0) {
      // the service is already enabled
      // must be enabled?
      if (config.enabled) {
        // service is enabled
        app.logger.debug(`service ${service_file} is enabled`);
      } else {
        // must be disabled
        let status = 0;
        // disable
        const disable = await spawnSync("sudo", ["systemctl", "disable", `${service_file}`]);
        status = status + disable.status;
        // daemon-reload
        const reload = await spawnSync("sudo", ["systemctl", "daemon-reload"]);
        status = status + reload.status;
        // reset-failed
        const reset = await spawnSync("sudo", ["systemctl", "reset-failed"]);
        status = status + reset.status;
        // check all status
        if (status === 0) {
          app.logger.info(`${service_file} disabled`);
        } else {
          throw new Error(`disable ${service_file} failed`);
        }
      }
    } else {
      // the service is disabled or not installed
      // must be enabled?
      if (config.enabled) {
        // service must be installed and enabled
        // enable and REBOOT required
        // setup destination file in systemd
        const dst = `/etc/systemd/${service_file}`;

        if (await existsSync(dst) || process.env.NODE_ENV === 'development') {
          app.logger.warn(`omit ${dst}`);
        } else {
          let ExecStart = `/usr/bin/npm start`;
          if (config.type === "binary") {
            ExecStart = `${app.appDir}/${config.service_name}`;
          }
          // setup the file content
          const content =
`[Unit]
Description=${config.service_name}
After=network.target

[Service]
User=${config.user}
Group=${config.group}
Environment=NODE_ENV=production
WorkingDirectory=${app.appDir}
ExecStart=${ExecStart}
Restart=always

[Install]
WantedBy=multi-user.target
`;
          // save the content into /tmp/config.txt
          const src = `/tmp/${service_file}`;
          await writeFileSync(src, content);
          // then copy as sudo to /etc/systemd
          await spawnSync("sudo", ["cp", src, dst]);
          // now enable the service
          const enable = await spawnSync("sudo", ["systemctl", "enable", `/etc/systemd/${service_file}`]);
          if (enable.status === 0) {
            app.logger.info(`${service_file} enabled`);
          } else {
            throw new Error(`enable ${service_file} failed`);
          }
        }
      } else {
        // is disabled
        app.logger.debug(`service ${service_file} disabled`);
      }
    }
  }
};
