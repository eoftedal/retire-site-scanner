// Reads file with domains, and invokes phantomjs with site.js for each domain. Runs 20 phantomjs in parallel

var fs		= require('fs'),
	lazy	= require('lazy'),
	Emitter	= require('events').EventEmitter,
	path	= require('path'),
	spawn	= require('child_process').spawn;

var threads_max = 20;
var threads = 0;

var events = new Emitter();
var donedir = 'phantom-done';
if (!fs.existsSync(donedir)) fs.mkdirSync(donedir);

var timeBegin = new Date().getTime();

if (process.argv.length !== 3) {
	console.log('Usage: node site-scanner.js <file-with-domain-list>');
	process.exit();
}
var dfile = process.argv[2];



function scan(url) {
	console.log('Scanning\t' + url + ' ...');
	var timeout;
	var begin = new Date().getTime();
	var child = spawn('phantomjs', ['--load-images=false', 'site.js', url]);
	var timed_out = {"value": false };
	child.on('close', function(code) {
		var end = (new Date().getTime() - begin) + 'ms';
		if (code !== 0) {
			if (timed_out.value) {
				console.warn('Timeout\t' + code + ' ' + url, end );
			} else {
				console.warn('Error\t' + code + ' ' + url, end );
			}
		} else {
			console.log('Done\t\t' + url, end);
		}
		threads--;
		clearTimeout(timeout);
		events.emit('phantom-ready');
	});
	timeout = setTimeout(function() {
		timed_out.value = true;
		child.kill();
	}, 2*60*1000);
}

var domains = [];

events.on('domain', function(domain) {
	domains.push(domain);
	if(domains.length % 1000 === 0) {
		console.log('Domains loaded: ' + domains.length);
	}
	events.emit('phantom-ready');
});

var dix = 0;
var num = 0;
events.on('phantom-ready', function() {
	if (dix >= (domains.length) || threads >= threads_max) return;
	var domain = domains[dix++];
	if (!fs.existsSync(path.join(donedir, domain + '.log'))) {
		threads++;
		num++;
		console.log(threads, num, dix + '/' + domains.length, '(' + Math.round(dix/domains.length*100) + '%)' ,  Math.round((new Date().getTime() - timeBegin)/1000) + 's');
		scan(domain);
	} else {
		events.emit('phantom-ready');
	}
});


console.log('Reading file ' + dfile + ' ...');
new lazy(fs.createReadStream(dfile))
	.lines
	.forEach(function(domain) {
		if (domain) events.emit('domain', domain);
	});
