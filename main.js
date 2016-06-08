'use strict'
const fs = require('fs')
const url = require('url')
const http = require('http')
const https = require('https')
const path = require('path')

const express = require('express')
const bodyParser = require('body-parser')

const global = {
	downloadedPath: `${__dirname}/public/download/`,
	downloadingPath: `${__dirname}/public/downloading/`,
	downloadedJsonPath: `${__dirname}/public/downloaded.json`,
	downloadObj: {
		downloaded: {},
		downloading: {}
	}
}

const app = express()


app.get('/download/:file', (req, res, next) => {
	downloadedIncrease(req.params.file)
	next()
})

app.use(express.static('public'))

app.get('/download', (req, res, next) => {
	let result = {
		downloaded: [],
		downloading: [],
	}

	for(let key in global.downloadObj.downloaded) {
		result.downloaded.push(global.downloadObj.downloaded[key])
	}

	for(let key in global.downloadObj.downloading) {
		result.downloading.push(global.downloadObj.downloading[key])
	}
	res.json(result)
})

app.get('/:url', (req, res, next) => {
	get(req.params.url)

	function get(urlparam) {
		if(!urlparam) {
			res.status(404).end()
			return
		}

		let urlobj = url.parse(urlparam)

		let now = Date.now()
		let guid = `${Math.random().toString(36).slice(2)}`
		global.downloadObj.downloading[guid] = {
			file: urlobj.href,
			current: 0,
			total: 0,
			begintime: now
		}

		let location = false
		let protocol = urlobj.protocol == 'https:' ? https : http
		protocol.get(urlobj.href, (remote) => {
			if(remote.headers.location) {
				location = true
				delete global.downloadObj.downloading[guid]
				get(remote.headers.location)
				return
			}
			res.set(remote.headers)

			let name = urlobj.href
			if(req.query.name == 'filename') {
				name = path.parse(urlobj.hostname + urlobj.pathname).base
			} else if (req.query.name == 'random') {
				name = Math.random().toString(35).slice(2, 66)
			}
			name = `${guid}_${encodeURIComponent(name)}`
			let downloadingName = `${global.downloadingPath}${name}`
			let downloadName = `${global.downloadedPath}${name}`
			global.downloadObj.downloading[guid].total = remote.headers['content-length']

			remote.on('data', (data) => {
				res.write(data)
				global.downloadObj.downloading[guid].current += data.length
				fs.appendFile(downloadingName, data, (err) => {})
			})
			remote.on('end', () => {
				res.end()
				delete global.downloadObj.downloading[guid]
				fs.rename(downloadingName, downloadName, (err) => {
					if(err) {
						return
					}
					downloadedUpdate(name, now)
				})
			})

		}).on('error', (err) => {
			console.log(err)
			if(location) {
				return
			}
			res.status(404).end()
			delete global.downloadObj.downloading[guid]
		})
	}
})


app.listen(3000)

downloadedLoad()

function downloadedUpdate(filename, begintime) {
	global.downloadObj.downloaded[filename] = {
	}
	stat(filename, (fileObj) => {
		fileObj.begintime = begintime || 0,
		fileObj.endtime = Date.now()

		fs.writeFile(global.downloadedJsonPath, JSON.stringify(global.downloadObj.downloaded, null, 2))
	})

}

function downloadedIncrease(filename) {
	if(!global.downloadObj.downloaded[filename]) {
		return
	}
	global.downloadObj.downloaded[filename].count = global.downloadObj.downloaded[filename].count || 0
	global.downloadObj.downloaded[filename].count += 1

	fs.writeFile(global.downloadedJsonPath, JSON.stringify(global.downloadObj.downloaded, null, 2))

}

function downloadedLoad() {
	global.downloadObj.downloaded = require(global.downloadedJsonPath)

	fs.readdir(global.downloadedPath, (err, files) => {
		if(err) {
			console.log(err)
			return
		}

		let count = 0
		let time = Date.now()
		files.forEach((filename, index) => {
			stat(filename, (fileObj) => {
				fileObj.time = time
				count += 1
				if(count == files.length) {
					for(let key in global.downloadObj.downloaded) {
						if(global.downloadObj.downloaded[key].time != time) {
							global.downloadObj.downloaded[key].delete = true
						}
					}
					fs.writeFile(global.downloadedJsonPath, JSON.stringify(global.downloadObj.downloaded, null, 2))
				}
			})
		})
	})
}

function stat(filename, cb) {
	fs.stat(global.downloadedPath + filename, (err, stat) => {
		global.downloadObj.downloaded[filename] = global.downloadObj.downloaded[filename] || {}
		let fileObj = global.downloadObj.downloaded[filename]
		if(!err) {
			fileObj.filename = filename,
			fileObj.size = stat.size,
			fileObj.birthtime = Date.parse(stat.birthtime),
			fileObj.atime = Date.parse(stat.atime),
			fileObj.mtime = Date.parse(stat.mtime),
			fileObj.ctime = Date.parse(stat.ctime),
			fileObj.begintime = fileObj.begintime || 0,
			fileObj.endtime = fileObj.endtime || 0,
			fileObj.count = fileObj.count || 0
		}
		cb(fileObj)
	})
}
