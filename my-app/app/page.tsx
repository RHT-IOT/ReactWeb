// App.js
"use client";
import { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";

function App() {
  const auth = useAuth();
  const [userInfo, setUserInfo] = useState({ username: "" , name: ""});

  useEffect(() => {
    const fetchUserInfo = async () => {

      console.log("Hi");
      if (auth.isAuthenticated) {
        const response = await fetch(
          "https://ap-southeast-2d19wijvbp.auth.ap-southeast-2.amazoncognito.com/oauth2/userInfo",
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${auth.user.access_token}`,
            },
          }
        );
        const data = await response.json();
        console.log("User Info:", data);
        setUserInfo(data);
      }
    };

    fetchUserInfo();
  }, [auth.isAuthenticated, auth.user?.access_token]);

  const signOutRedirect = () => {
    const clientId = "7bj6qolgca3bbcshiuiinp9tj4";
    const logoutUri = "<logout uri>";
    const cognitoDomain = "https://ap-southeast-2d19wijvbp.auth.ap-southeast-2.amazoncognito.com";
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };

  if (auth.isLoading) {
    return <div>Loading...</div>;
  }

  if (auth.error) {
    return <div>Encountering error... {auth.error.message}</div>;
  }
  if (auth.isAuthenticated) {
    return (
      <div>
        {/* <pre> Hello: {auth.user?.profile.email} </pre> */}
        <pre> Welcome {userInfo.username}!!</pre>
        <pre> ID Token: {auth.user?.id_token} </pre>
        <pre> Access Token: {auth.user?.access_token} </pre>
        <pre> Refresh Token: {auth.user?.refresh_token} </pre>

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