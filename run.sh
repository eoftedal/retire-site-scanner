#!/bin/bash
while true; do
	killall phantomjs
	node site-scanner.js domain-clean.txt
	sleep 5
done
