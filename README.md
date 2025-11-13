## 1. PutDevUserAccess
Add device and user to the table
Trigger: API through admin panel
Table: UserLocationAccess (output)
## 2. getDsidSsidFromBDZL
get the DsidSsid from bdzl and put to controlIDTable
Trigger: through API -> delete the whole table and fetch from BDZL again
Trigger: through DynamoDB stream -> add when there is update in SensorBoxModel
Table: SensorBoxModel (input) | controlIDTable (output)
## 3. getDevIDFromUserName
Get the list of deviceID from the user email
Trigger: API through react web call every time init the webpage.
Table: UserLocationAccess (input) | SensorBoxModel (input)
## 4. getCPDsidSdid
Get the list of dsid and ssid from the table to load to the control panel
Trigger: API through react web in control panel page.
Table: controlIDTable (input)
## 5. getDataFromBDZL
Get all the device id that need to be fetch from the sensor box model table and get the latestdp from bdzl
Trigger: EventBridge
Table: SensorBoxModel (input) | IAQSensorData (ouput)
