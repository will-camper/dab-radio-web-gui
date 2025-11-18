# DAB Radio HTML GUI

Simple HTML/Javascipt GUI to display an interface to welle.io DAB Player

## Description

Web UI component intended for integration into e.g. HeadUnit code using welle.io DAB backend.

There are three components
* The welle.io backend webserver, that provides information on the available multiplexes and will stream the mp3 audio
* A flask python app that serves the html/javascript components, saves the channel list etc. and proxies calls to welle.io backend
* The html/javascript interface which communicates with the python app, and plays the media stream directly from welle.io backend.

## Getting Started

### Dependencies

* rtl-sdr hardware. Tested with https://www.rtl-sdr.com/v4/ on Raspberry Pi 5 / Trixie
* Installation will install welle.io, but I recommend installing this first and ensuring it works.

### Installing

This 
* Install dependencies
* Setup Python environment
* Pull DAB reference info and station icons from RadioDNS UK https://www.radiodns.uk/
```
git clone git@github.com:will-camper/dab-radio-web-gui.git
cd dab-radio-web-gui
./install.sh
```

### Executing program

```
cd dab-radio-web-gui
./run.sh
```

## Help

Definately a beta version!
Sometimes audio will not sync when changing channels. Pause/Play needed to restart 

## Authors



## Version History

* 0.1
    * Initial Release

## License

This project is licensed under the [NAME HERE] License - see the LICENSE.md file for details

## Acknowledgments

Inspiration, code snippets, etc.
* [welle.io](welle.io)https://www.welle.io
* [Radio DNS UK]https://www.radiodns.uk/



