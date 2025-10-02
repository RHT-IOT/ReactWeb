// App.js
"use client";
import { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import Form from 'react-bootstrap/Form';

function SelectBasicExample({ IMEI ,value, setValue}) {
  const handleSelect=(e)=>{
    if(e.target.value){
      console.log(e.target.value);
      setValue(e.target.value)
    }
  }
  return (
    <Form.Select aria-label="Default select example" onChange={handleSelect}>
      <option value="">Choose your IMEI code</option>
       {IMEI.map((opt, index) => (
          <option key={index} value={opt}>
            {opt}
          </option>
        ))}
    </Form.Select>
  );
}
function dropboxDev({ IMEI ,value, setValue}) {
  const handleSelect=(e)=>{
    if(e.target.value){
      console.log(e.target.value);
      setValue(e.target.value)
    }
  }
  return (
    <Form.Select aria-label="Default select example" onChange={handleSelect}>
      <option value="">Choose your IMEI code</option>
       {IMEI.map((opt, index) => (
          <option key={index} value={opt}>
            {opt}
          </option>
        ))}
    </Form.Select>
  );
}
function App() {
  const auth = useAuth();
  const [userInfo, setUserInfo] = useState({ username: "" , name: ""});
  const [IMEI_ARR, setIMEI_ARR] = useState([]);
  const [IMEI,setIMEI]=useState('');
  const [deviceMap, setDeviceMap]=useState('');
  const [deviceType, setDeviceType]=useState('');
  const [device, setDevice]=useState('');

  useEffect(() => {
    const fetchUserInfo = async () => {

      console.log("Hi");
      if (auth.isAuthenticated) {
        const response = await fetch(
          "https://ap-southeast-2d19wijvbp.auth.ap-southeast-2.amazoncognito.com/oauth2/userInfo",
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${auth.user?.access_token}`,
            },
          }
        );
        const data = await response.json();
        console.log("User Info:", data);
        setUserInfo(data);
      }
      
    };

    fetchUserInfo();
    const callApi = async (email) => {
      
    if(auth.isAuthenticated && email){
      const response = await fetch("https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test/getIMEI", {
        method: "POST",
        headers: { "Content-Type": "application/json" , 
          "Authorization": `Bearer ${auth.user?.id_token}`,},
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      const arr =  JSON.parse(data?.body);
      const flat = arr.flat(); 
      console.log("IMEI:", flat);
      setIMEI_ARR(flat);
    };
    
    }
    callApi(auth.user?.profile.email);
  }, [auth.isAuthenticated, auth.user?.access_token,auth.user?.profile.email,auth.user?.id_token]);
  
    const getLatestDp = () => {
    return fetch("https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test/getLatestDP", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${auth.user?.id_token}`,
      },
      body: JSON.stringify({ IMEI }),
    })
      .then(res => res.json())
      .then(data => {
        console.log("API response:", data);
        const temp = JSON.parse(data.body);
        const map = {};
        const dev = {};
        let idx = 0;
        for (const item of temp) {
          dev[idx] = item.DeviceType;
          map[item.DeviceType] = item;
        }
        setDeviceMap(map);
        setDeviceType(dev);
        // do something with data here
      })
      .catch(err => console.error("Fetch error:", err));
  };
  const signOutRedirect = () => {
    const clientId = "7bj6qolgca3bbcshiuiinp9tj4";
    const logoutUri = "<logout uri>";
    const cognitoDomain = "https://ap-southeast-2d19wijvbp.auth.ap-southeast-2.amazoncognito.com";
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };
  https://6ts7sjoaw6.execute-api.ap-southeast-2.amazonaws.com/test
  if (auth.isLoading) {
    return <div>Loading...</div>;
  }

  if (auth.error) {
    return <div>Encountering error... {auth.error.message}</div>;
  }
  if (auth.isAuthenticated) {
    return (
      <div>
        <SelectBasicExample IMEI = {IMEI_ARR} value={IMEI} setValue={setIMEI}/>
        {/* <SelectBasicExample IMEI = {deviceType} value={device} setValue={setDevice}/> */}
        {/* <pre> Hello: {auth.user?.profile.email} </pre> */}
        <pre> Welcome {userInfo.username}!!</pre>
        <pre> ID Token: {auth.user?.id_token} </pre>
        <pre> Access Token: {auth.user?.access_token} </pre>
        <pre> Refresh Token: {auth.user?.refresh_token} </pre>
        <pre>{JSON.stringify(deviceMap["Voltage1"], null, 2)}</pre>
        <button onClick={getLatestDp}>Refresh</button>
        <button onClick={() => auth.removeUser()}>Sign out</button>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => auth.signinRedirect()}>Sign in</button>
      <button onClick={() => signOutRedirect()}>Sign out</button>
    </div>
  );
}

export default App;