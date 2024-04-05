const yggdrasil = require('yggdrasil')
const fs = require('fs')
const cacheFile = './cache.json'

module.exports = async function (client, options) {
  if (options.cache === true) {
    if(!fs.existsSync("./cache.json")) {
      fs.writeFileSync(cacheFile, '[]')
    }
    try {
      options.sessionFile = JSON.parse(fs.readFileSync("./cache.json", "utf8"))
    } catch (err) {
      fs.writeFileSync('./cache.json', '[]', "utf-8")
      options.sessionFile = []
    }
  }

  const yggdrasilClient = yggdrasil({ agent: options.agent})
  const skipValidation = false || options.skipValidation
  options.accessToken = null
  options.haveCredentials = !!options.alt

  if (options.alt) {
    // make a request to get the case-correct username before connecting.
    const cb = function (err, session, skipWrite) {
      if (options.cache === true && session && !skipWrite) {
        options.sessionFile.push({ ...session, alt: options.alt})
        fs.writeFileSync("./cache.json", JSON.stringify(options.sessionFile, null, 4), "utf-8")
      }

      if (err) {
        client.emit('error', err)
      } else  {
        client.username = session.mcName || session.mcname
        client.session = {
          selectedProfile: {
            id: session.uuid
          }
        }
        session = {
          ...session,
          auth: options.auth,
          server: `${options.host}:${options.port === undefined ? "25565" : options.port}`
        }
        options.accessToken = session
        client.emit('session', session)
        options.connect(client)
      }
    }

    options.session = options.sessionFile.find(x => x.alt === options.alt)
    if (options.session) {
      if (!skipValidation) {
        yggdrasilClient.validate(options.session.accessToken, function (err) {
          if (!err) { cb(null, options.session) } else {
            yggdrasilClient.refresh(options.session.accessToken, options.session.clientToken, function (err, accessToken, data) {
              if (!err) {
                cb(null, data)
              } else if (options.username && options.password) {
                yggdrasilClient.auth({
                  user: options.username,
                  pass: options.password,
                  requestUser: true
                }, cb)
              } else {
                cb(err, data)
              }
            })
          }
        })
      } else {
        // trust that the provided session is a working one
        cb(null, options.session, true)
      }
    } else {
      yggdrasilClient.auth({
        alt: options.alt,
        auth: options.auth
      }, cb)
    }
  } else {
    // assume the server is in offline mode and just go for it.
    client.username = options.username
    options.connect(client)
  }
}
