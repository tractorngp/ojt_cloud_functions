import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as bcrypt from 'bcrypt';
import * as nodemailer from 'nodemailer';

admin.initializeApp();

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript
const db = admin.firestore();

let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'tractorpgapp@gmail.com',
        pass: 'tractorpgapp2020'
    }
});

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
export const getCollectionQueryTotalCount = functions.https.onCall(async (data, context) => {
    console.log("User: " + data.collection)
    const collection = data.collection;
    const isActiveRequired = data.isActiveRequired
    let totalCount;
    if(isActiveRequired !== null && isActiveRequired === true){
        totalCount = await db.collection(collection)
        .where("active", "==", true)
        .get().then(function(snapshots){
            console.log("Snapshots: " + snapshots.docs.length)
            return (snapshots !== null ? snapshots.docs.length : 0);
        })
        .catch(function(error) {
            console.log("Error getting documents: ", error);
        });
    }
    else{
        totalCount = await db.collection(collection)
        .get().then(function(snapshots){
            console.log("Snapshots: " + snapshots.docs.length)
            return (snapshots !== null ? snapshots.docs.length : 0);
        })
        .catch(function(error) {
            console.log("Error getting documents: ", error);
        });
    }
    
    return {
        "total": totalCount
    };
});

export const assignRecordIdToOJT = functions.firestore.document('assigned_ojts/{doc_id}')
        .onCreate((change, context) => {
            const documentId = context.params.doc_id;
            change.ref.update({
                record_id: documentId
            }).then(_ => {
                console.log('record Id added successfully');
            }).catch(error => {
                console.error(error, 'Error adding record Id');
            });
});

export const sendEmailToUser = functions.firestore.document('users/{doc_id}')
        .onCreate(async (snapshot, context) => {
            console.log("Creating User");
            let hashVal: any;
            const email = snapshot.get('email');
            const pw = snapshot.get('hpw');
            const tokenID = snapshot.get('tokenId');
            console.log("Email: " + email);
            bcrypt.hash(pw, "$2b$10$naep/GGixFkQDlpnBuEJAO").then(res => {
                hashVal = res;
                console.log("No Errors")
                snapshot.ref.update({
                    hpw: hashVal
                }).then(_ => {
                    console.log('User added successfully');
                }).catch(error => {
                    console.error(error, 'Error adding User');
                });
            }).catch(err => {
                console.log(err);
            });


            const mailOptions = {
                from: 'Tractor NGP <tractorpgapp@gmail.com>',
                to: email,
                subject: 'Tractor NGP OJT app registration', // email subject
                html: `<p style="font-size: 16px;">User ID:` + tokenID + `</p> <br />
                Password: `+ pw +`
                ` // email content in HTML
            };
      
            // returning result
            transporter.sendMail(mailOptions, (err: any, info: any) => {
                if(err){
                    console.log(err)
                }
                console.log(info);
            });
});
   