#!/bin/sh
# 
# This script transforms the final artifacts to run service worker in classic mode

sed -i 's/import\.meta\.url/location\.origin/g' dist/sw.js
sed -i 's/type:"module"/type:"classic"/g' dist/assets/*.js
