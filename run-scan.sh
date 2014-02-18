#!/bin/bash
while true; do
	killall nodejs
	node retire-scanner.js
	echo "Died... restarting in 5 sec..."
	sleep 5
done
