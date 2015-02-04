Retire-site-scanner
-------------------
Simple scanner for scanning a list of domains with [PhantomJS](http://phantomjs.org/) and [RetireJS](http://github.com/bekk/retire.js/)

Prequisites
-----------
You need to have phantomjs (tested with version 1.9.8), node (tested with 0.10.x) and npm installed

Installation
------------

    git clone https://github.com/eoftedal/retire-site-scanner.git
    cd retire-site-scanner
    npm install


Running
-------
Create a file with one domain per line (e.g. domains.txt)

    node site-scanner.js domains.txt
    node retire-scanner.js

Results
-------
site-scanner.js runs phantomjs on the given domains and creates one file per domain in phantom-done (phantom-running is the work dir). This file contains a list of javascript files referenced by the domain. It also runs some javascript functions on the page to try to detect javascript libraries.

retire-scanner.js runs through files in phantom-done and checks each script-file using retire.js. It will download the script into memory if needed. results-running is the work dir. The results for each domain are put in a file per domain in results-done.

In results-done the syntax is 

    1392714022790 x f www.example.com http://example.com/js/jquery-1.7.1.min.js jquery 1.7.1.min
    1392714020956 ? www.example.com http://www.example.com/js/weather.js

On the first line it managed to detect the javascript. The first number is a timestamp. The 'x' means vulnerable, while '-' means benign. '?' as seen in the second line, means not identified. The 'f' after the 'x' is which type of detection was used ('f' = filename, 'u' = url, 'c' = filecontents, 'j' = javascript function). Next comes domain, url, library and version.

Common analytics scripts like google analytics are not checked and printed as:

    1392714020211 - u www.example.com http://www.google-analytics.com/ga.js dont check www
