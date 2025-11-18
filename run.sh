#!/bin/bash
welle-cli -s "driver=sdrplay,soapy=0,rfnotch_ctrl=true,dabnotch_ctrl=true" -w 8888  &

source bin/activate
python dab_server.py

