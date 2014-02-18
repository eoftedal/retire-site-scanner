// Reads files from phantom-done, checks each javascript and tries to detect files using retire. Keeps temporary results in 
// results-running and finished scans in results-done.

var fs			= require('fs'),
	lazy		= require('lazy'),
	repo		= require('retire/lib/repo'),
	retire		= require('retire/lib/retire'),
	Emitter		= require('events').EventEmitter,
	Url			= require('url'),
	crypto		= require('crypto'),
	request		= require('request'),
	stream		= require('stream'),
	path		= require('path'),
	fork		= require('child_process').fork,
	spawn		= require('child_process').spawn,
	readline	= require('readline');


var events = new Emitter();
var retireconfig = { 'nocache' : true };
var jsrepo;
var thread;
var rundir = 'results-running';
var donedir = 'results-done';
var phantomdonedir = 'phantom-done';

if (!fs.existsSync(rundir)) fs.mkdirSync(rundir);
if (!fs.existsSync(donedir)) fs.mkdirSync(donedir);


var hash = {
	'sha1' : function(data) {
		shasum = crypto.createHash('sha1');
		shasum.update(data);
		return shasum.digest('hex');
	}
};

events.on('load-repo', function() {
  repo.loadrepository('https://raw.github.com/bekk/retire.js/master/repository/jsrepository.json', retireconfig)
	.on('done', function(repo) {
		jsrepo = repo;
		events.emit('js-repo-loaded');
	});

});

function getFileName(url) {
	var u = Url.parse(url);
	return (u.pathname.match(/\/([^\/?#]+)((\?|#).*)?$/i) || [,""])[1];
}

function scan(repo, base, url, fd, ev) {
	var context = {};
	var results = retire.scanUri(url, repo);
	if (results.length > 0) {
		events.emit('result-ready', base, url, results, fd, 'u');
		ev.emit('done');
		return;
	}
	results = retire.scanFileName(getFileName(url), repo);
	if (results.length > 0) {
		events.emit('result-ready', base, url, results, fd, 'f');
		ev.emit('done');
		return;
	}
	try { 
		console.log((new Date().getTime()) + ' DL begin: ' + url + ' ...');
		var req = request.get(url, function (e, r, data) {
			console.log((new Date().getTime()) + ' DL done : ' + url + ' ...');
			try {
				if (context.failed) return;
				clearTimeout(context.timeout);
				results = retire.scanFileContent(data, repo, hash);
				if (results.length > 0) {
					events.emit('result-ready', base, url, results, fd, 'c');
					ev.emit('done');
					return;
				} else {
					log(fd, '? ' + base + ' ' + url);
					ev.emit('done');
				}
			} catch(ex) {
				log(fd, 'Failed hash for: ' + url);
				ev.emit('done');
			}
		}).on('socket', function(socket) {
		socket.setTimeout(20*1000);
		context.socket = socket;
		socket.on('timeout', function() {
			clearTimeout(context.timeout);
			context.failed = true;
			req.abort();
			log(fs, 'Timeout for: ' + url);
			ev.emit('done');
		});
	});
	context.timeout = setTimeout(function() {
		context.failed = true;
		if (context.socket) context.socket.destroy();
		req.abort();
		log(fs, 'Timeout for: ' + url);
		ev.emit('done');
	}, 22*1000);


       } catch(e) {
		log(fd, 'Download failed for: ' + url);
		ev.emit('done');
       }
}

events.on('result-ready', function(base, url, results, fd, detection) {
	if (results.length > 0) {
		var printed = {};
		results.forEach(function(elm) {
			var key = url + ' ' + elm.component + ' ' + elm.version;
			if (printed[key]) return;
			printed[key] = true;
			var vuln = '-';
			if (retire.isVulnerable([elm])) vuln = 'x';
			log(fd, vuln + ' ' + detection + ' ' + base + ' ' + key);
		});
	}
});


function log(fd, message) {
	try {
		console.log((new Date().getTime()) + ' [' + thread + '] ' + message);
		fs.writeSync(fd, (new Date().getTime()) + ' ' + message + "\n");
	} catch(e) {

	}
}

events.on('js-repo-loaded', function() {
	var files = [];
	var p = spawn('ls', ['-tr1', phantomdonedir]);
	p.stdout.on('data', function(line) {
		files.push(line);	
	});
	p.on('close', function() {
		files = files.join('').split('\n');
		while(files.length > 0 && !(files[files.length - 1])) {
			files.pop();
		}
		console.log('[' + thread + '] Found ' + files.length + ' domains');
		events.emit('files-ready', files);		
	});	
});

var dix = 0;
var step = 1;
var donefiles = null;
events.on('files-ready', function(files) {
	donefiles = files;
	events.emit('scanner-ready');
});


events.on('scanner-ready', function() {
	var i = dix;
	dix = dix + step;
	if (!donefiles[i]) return;
	var domain = donefiles[i].replace(/.log$/, '');
	console.log(dix, domain);
	var resultsfile = path.join(rundir, domain + '.log');
	var resultsdonefile = path.join(donedir, domain + '.log');
	if (!fs.existsSync(resultsdonefile)) {
		var fd = fs.openSync(resultsfile, 'w+');
		log(fd, 'Begin ' + domain);
		var outstream = new stream();
		outstream.readable = true;
		outstream.writable = true;
		var rl = readline.createInterface({
			input: fs.createReadStream(path.join(phantomdonedir, donefiles[i])),
			output: outstream,
			terminal: false
		});
		var scripts = [];
		rl.on('line', function(line) {
			if (line.indexOf('script: ') !== -1) {
				var url = line.split('script: ')[1];
				scripts.push(url);
			}
		});
		rl.on('close', function() {
			setTimeout(function() {
				events.emit('do-scan', 0, scripts, domain, fd, resultsfile, resultsdonefile);
			}, 0);
		});
	} else {
		setTimeout(function() {events.emit('scanner-ready'); }, 0);
	}
});

events.on('do-scan', function(i, scripts, domain, fd, resultsfile, resultsdonefile) {
	if (i >= scripts.length) {
		log(fd, 'Done ' + domain);
		fs.closeSync(fd);
		fs.renameSync(resultsfile, resultsdonefile);
		events.emit('scanner-ready');
		return;
	}
	var ev = new Emitter();
	ev.on('done', function() {
		events.emit('do-scan', i + 1, scripts, domain, fd, resultsfile, resultsdonefile);
	});
	scan(jsrepo, domain, scripts[i], fd, ev);
});


console.log(process.argv);
if (process.argv.length !== 2) {
	dix = parseInt(process.argv[2], 10);
	thread = dix;
	step = parseInt(process.argv[3], 10);
	console.log(dix, step);
	events.emit('load-repo');
} else {
	console.log('forking');
	var max = 20;
	for (var i = 0; i < max; i++) {
		var p = fork('retire-scanner.js', [], { execArgv: ['retire-scanner.js', i, max] });
	}
}




