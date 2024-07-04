import React, { useState, useEffect, useRef } from "react";
import { Socket, Channel } from "phoenix";
import axios from "axios";

const DriverApp = () => {
  const [socket, setSocket] = useState(null);
  const [channel, setChannel] = useState(null);
  const [tracking, setTracking] = useState(false);
  const [driverId, setDriverId] = useState("");
  const [status, setStatus] = useState(""); // Track the current status
  const intervalRef = useRef(null);
  const destination = { lat: 22.578647, lon: 88.4718067 }; // Hardcoded destination

  useEffect(() => {
    const newSocket = new Socket("ws://localhost:4000/socket", {
      params: { userToken: "driver" },
    });
    newSocket.connect();
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (driverId && socket) {
      const newChannel = socket.channel(`tracking:driver:${driverId}`, {});
      newChannel
        .join()
        .receive("ok", () => console.log("Connected successfully"))
        .receive("error", () => console.log("Connection failed"));
      setChannel(newChannel);

      return () => {
        newChannel.leave();
      };
    }
  }, [driverId, socket]);

  const calculateETA = async (latitude, longitude) => {
    try {
      const response = await axios.post(
        "http://localhost:5000/api/v1/calculate-eta",
        {
          driverId,
          currentLat: latitude,
          currentLon: longitude,
          destinationLat: destination.lat,
          destinationLon: destination.lon,
        }
      );
      console.log("ETA Calculation:", response.data);
    } catch (error) {
      console.error("Error calculating ETA:", error);
    }
  };

  const sendLocation = (currentStatus) => {
    if (navigator.geolocation && channel) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          channel.push("location_update", {
            id: driverId,
            lat: latitude,
            lon: longitude,
            status: currentStatus,
          });
          console.log(
            `Status: ${currentStatus}, Lat: ${latitude}, Lon: ${longitude}`
          );

          // Trigger ETA calculation on start
          if (currentStatus === "start") {
            calculateETA(latitude, longitude);
          }
        },
        (error) => {
          console.error("Error obtaining location", error);
        },
        { enableHighAccuracy: true }
      );
    }
  };

  const handleEndTracking = async () => {
    // API call to Node.js server to transfer data
    try {
      const response = await axios.post(
        "http://localhost:5000/api/v1/driver/end",
        {
          driverId,
          status: "end",
        }
      );
      console.log("Data transfer response:", response.data);
    } catch (error) {
      console.error("Error during data transfer:", error);
    }
  };

  const toggleTracking = () => {
    if (!tracking) {
      setStatus("start");
      sendLocation("start");
      intervalRef.current = setInterval(() => sendLocation("update"), 5000);
    } else {
      clearInterval(intervalRef.current);
      sendLocation("end");
      handleEndTracking();
      setStatus("");
    }
    setTracking(!tracking);
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Enter Driver ID"
        value={driverId}
        onChange={(e) => setDriverId(e.target.value)}
        disabled={tracking}
      />
      <button onClick={toggleTracking}>
        {tracking ? "Stop Tracking" : "Start Tracking"}
      </button>
      <p>Current Status: {status || "Not Tracking"}</p>
    </div>
  );
};

export default DriverApp;
