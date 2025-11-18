#!/bin/bash
welle-cli -s "driver=sdrplay,soapy=0,rfnotch_ctrl=true,dabnotch_ctrl=true" -w 8888  &

source .venv/bin/activate
gunicorn dab_server:gunicorn_app -b 127.0.0.1:5000
