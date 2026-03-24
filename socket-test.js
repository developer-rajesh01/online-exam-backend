// socket-test.js
import { io } from "socket.io-client";

const SERVER = "http://localhost:5000"; // change if different
const TEST_ID = "<PASTE_TEST_ID_HERE>"; // replace with the _id returned from create test

const socket = io(SERVER, {
    transports: ["websocket"],
    reconnectionAttempts: 5,
});

socket.on("connect", () => {
    console.log("connected", socket.id);
    socket.emit("joinTest", TEST_ID);
    socket.emit("joinAudience", "BCA"); // join audience too (optional)
});

socket.on("testCreated", (p) => {
    console.log("testCreated:", p);
});

socket.on("testStatusChanged", (p) => {
    console.log("testStatusChanged:", p);
    if (p.status === "completed") {
        console.log("Test completed — you can auto-submit here.");
    }
});

socket.on("disconnect", (r) => console.log("disconnected", r));
socket.on("connect_error", (err) => console.error("connect_error", err.message));
