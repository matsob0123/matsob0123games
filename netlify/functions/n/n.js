// with thanks to https://github.com/codeniko/simple-tracker/blob/master/examples/server-examples/aws-lambda/google-analytics.js

const fetch = require('node-fetch')
const { v4: uuidv4 } = require('uuid')

const GA_ENDPOINT = `https://www.google-analytics.com/collect`

const whitelistDomain = function (domain, addWww = true) {
  const prefixes = ['https://', 'http://']
  if (addWww) {
    prefixes.push('https://www.', 'http://www.')
  }
  prefixes.forEach((prefix) => {
    originWhitelist.push(prefix + domain)
  })
}

// Domains to whitelist. Replace with your own!
// keep this empty and append domains to whitelist using whiteListDomain()
const originWhitelist = []
whitelistDomain('test.com')
whitelistDomain('nfeld.com')

const proxyToGoogleAnalytics = async function (event) {
  // get GA params whether GET or POST request
  const params = event.httpMethod.toUpperCase() === 'GET' ? event.queryStringParameters : JSON.parse(event.body)
  const headers = event.headers || {}

  // attach other GA params, required for IP address since client doesn't have access to it. UA and CID can be sent from client
  // ip override. Look into headers for clients IP address, as opposed to IP address of host running lambda function
  params.uip = headers['x-forwarded-for'] || headers['x-bb-ip'] || ''
  // user agent override
  params.ua = params.ua || headers['user-agent'] || ''
  // REQUIRED: use given cid, or generate a new one as last resort. Generating should be avoided because one user can show up in GA multiple times. If user refresh page `n` times, you'll get `n` pageviews logged into GA from "different" users. Client should generate a uuid and store in cookies, local storage, or generate a fingerprint. Check simple-tracker client example
  params.cid = params.cid || uuidv4()

  console.info('proxying params:', params)
  const qs = new URLSearchParams(params).toString()

  try {
    const { ok, status, statusText } = await fetch(GA_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'image/gif' },
      body: qs,
    })
    if (!ok) {
      throw new Error(`HTTP error ${status}`)
    }
    console.info('googleanalytics status code', status, statusText)
  } catch (error) {
    console.info('googleanalytics error!', error)
  }
}

const handler = async function (event) {
  const origin = event.headers.origin || event.headers.Origin || ''
  const httpMethod = event.httpMethod.toUpperCase()

  console.log(`Received ${httpMethod} request from, origin: ${origin}`)

  const isOriginWhitelisted = originWhitelist.includes(origin)
  console.info('is whitelisted?', isOriginWhitelisted)

  const headers = {
    // 'Access-Control-Allow-Origin': '*', // allow all domains to POST. Use for localhost development only
    'Access-Control-Allow-Origin': isOriginWhitelisted ? origin : originWhitelist[0],
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Accept',
  }

  // CORS (required if you use a different subdomain to host this function, or a different domain entirely)
  if (httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  // allow GET or POST, but only for whitelisted domains
  if ((httpMethod === 'GET' || httpMethod === 'POST') && isOriginWhitelisted) {
    await proxyToGoogleAnalytics(event)
    return { statusCode: 200, headers, body: '' }
  }

  return { statusCode: 404, headers, body: 'Not found' }
}

module.exports = { handler }

//
// Docs on GA endpoint and example params
//
// https://developers.google.com/analytics/devguides/collection/protocol/v1/devguide
//
// v: 1
// _v: j67
// a: 751874410
// t: pageview
// _s: 1
// dl: https://nfeld.com/contact.html
// dr: https://google.com
// ul: en-us
// de: UTF-8
// dt: Nikolay Feldman - Software Engineer
// sd: 24-bit
// sr: 1440x900
// vp: 945x777
// je: 0
// _u: blabla~
// jid:
// gjid:
// cid: 1837873423.1522911810
// tid: UA-116530991-1
// _gid: 1828045325.1524815793
// gtm: u4d
// z: 1379041260
//
