import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript
const db = admin.firestore();

export const helloWorld = functions.https.onRequest((request, response) => {
 response.send("Hello from Firebase!");
});

export const callHelloWorld = functions.https.onCall(async (data, context) => {
    return "Hello World";
});

export const callNumberOfOJTs = functions.https.onCall(async (data, context) => {
    console.log("User: " + data.user)
    const user = data.user;
    const userRef = db.collection('users').doc(user);

    const pendingCount = await db.collection('assigned_ojts')
    .where("active", "==", true)
    .where("assigned_to", "==", userRef)
    .where("status","==", "assigned")
    .orderBy("record_id","asc")
    .get().then(function(snapshots){
        console.log("Snapshots: " + snapshots.docs.length)
        return (snapshots !== null ? snapshots.docs.length : 0);
    })
    .catch(function(error) {
        console.log("Error getting documents: ", error);
    });

    const totalCount = await db.collection('assigned_ojts')
    .where("active", "==", true)
    .where("assigned_to", "==", userRef)
    .orderBy("record_id","asc")
    .get().then(function(snapshots){
        console.log("Snapshots: " + snapshots.docs.length)
        return (snapshots !== null ? snapshots.docs.length : 0);
    })
    .catch(function(error) {
        console.log("Error getting documents: ", error);
    });
    
    return {
        "pending": pendingCount,
        "total": totalCount
    };
});