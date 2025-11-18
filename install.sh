#!/bin/bash
sudo apt install -y welle.io curl

mkdir resources
curl https://www.radiodns.uk/logos/RadioStationLogos_128x128.zip --output resources/logos.zip
curl https://www.radiodns.uk/services.json --output resources/dab_services.json
unzip -j resources/logos.zip -d resources
rm resources/logos.zip

python -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
