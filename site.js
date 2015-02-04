// Scans a single domain using phantomjs, keeps temporary results in phantom-running and when done, moves it to phantom-done

var fs		= require('fs'),
	page	= require('webpage').create(),
	system	= require('system');

page.settings.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.114 Safari/537.36';


var rundir = 'phantom-running';
var donedir = 'phantom-done';



if (!fs.exists(rundir)) fs.makeDirectory(rundir);
if (!fs.exists(donedir)) fs.makeDirectory(donedir);


if (system.args.length === 1) {
	console.log('No url passed');
}
var url = system.args[2];
var f = fs.open(system.args[1], "r");
var funcs = JSON.parse(f.read());

var filename = rundir + '/' + url.replace(/\//g, "_") + '.log';
var donefilename = donedir + '/' + url.replace(/\//g, "_") + '.log';
var file = fs.open(filename, 'w');
console.log(url);
console.log(filename);

function logmsg(msg) {
	console.log(msg);
	file.writeLine(new Date().getTime() + ' ' + msg);
	file.flush();
}

logmsg('Scanning ' + url + ' ...');


page.onResourceRequested = function(requestData, networkRequest) {
	if(requestData.url.match(/.*\.css(\?.*)?$/)) {
		networkRequest.abort();
	}
};

page.onResourceReceived = function(response) {
	if(response.contentType && response.stage === 'end') {
		if (response.contentType.match(/javascript/i)) {
			logmsg('script: ' + response.url);
		}
	}
};

page.settings.resourceTimeout = 30000;

page.onResourceTimeout = function(requestData, networkRequest) {
        logmsg('Timeout: ' + requestData.url);
};


page.open('http://' + url, function (status) {
	logmsg('Status ' + status)
	try {
		setTimeout(function() {
            for (var i in funcs) {
                (function() {
                    try {
                        var func = funcs[i];
                        var result = page.evaluate(new Function("try { return " + func.func + "; } catch(e) { return null; }"));
                        if (result) {
                            logmsg("component:" + JSON.stringify({name :  func.component, "version": result }));
                        }
                        console.log("Running " + func.func + " - Result: " + result);
                    } catch(e) {
                        console.log(e);
                    }
                })();
            }
		logmsg('Done');
			file.close();
			if (fs.exists(donefilename)) fs.remove(donefilename);
			fs.move(filename, donefilename);
			phantom.exit();
        }, 1000);
	} catch(e) {
		console.log(e);
		phantom.exit(1);
	}
});
