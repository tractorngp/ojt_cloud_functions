import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as bcrypt from 'bcrypt';
import * as nodemailer from 'nodemailer';

admin.initializeApp();

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript
const db = admin.firestore();

const transporter = nodemailer.createTransport({
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
        .onCreate(async(change, context) => {
            const documentId = context.params.doc_id;

            const userRef = change.get('assigned_to');
            const ojt_name = change.get('ojt_name');
            console.log("OJT name: " + ojt_name);
            userRef.get().then((userData: any) => {
                console.log('User token: ' + userData.data().tokenId);
                db.collection('users').doc(userData.data().tokenId).onSnapshot(async (snapshot) => {
                    const user = snapshot.data();
                    const deviceTokenToSend = user?.pushToken;
                    console.log("Device Token: " + deviceTokenToSend);
                    const payload = {
                        notification: {
                            title: 'You have a new OJT!',
                            body: `Hey ` + user?.name + `, you have been assigned : ` + change.get('ojt_name'),
                            icon: "https://firebasestorage.googleapis.com/v0/b/ojtappl.appspot.com/o/ic_launcher.png?alt=media&token=952a8a52-8e2d-42c2-812b-ca3bc9c53467"
                        }
                    };
                    console.log('Sending notification');
                    const response = await admin.messaging().sendToDevice(deviceTokenToSend, payload);
                    response.results.forEach((result, index) => {
                        const error = result.error;
                        if (error) {
                            console.error('Failure sending notification to', deviceTokenToSend, error);
                            // Cleanup the tokens who are not registered anymore.
                            if (error.code === 'messaging/invalid-registration-token' ||
                                error.code === 'messaging/registration-token-not-registered') {
                                    console.log("Error sending notification");
                            }
                        }
                        else{
                            console.log('Success sending notification');
                        }
                    });
                })
            });

            change.ref.update({
                record_id: documentId
            }).then( _ => {
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
                html: `<p style="font-size: 16px;">Welcome to OJT app. You have been registered with User ID:` + tokenID + `</p> <br />
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

export const deleteUserWithData = functions.firestore.document('users/{doc_id}')
        .onDelete(async (snapshot, context) => {
        const userRef = snapshot.ref;

        const writeBatch = db.batch();

        db.collection('assigned_ojts')
        .where("assigned_to", "==", userRef).onSnapshot(async (ojtSnapshot) => {
            const ojts = ojtSnapshot.docs;

            ojts.forEach((ojt) => {
                const ojtRef = ojt.ref;
                writeBatch.delete(ojtRef);
            });

            db.collection('groups')
            .where("group_members", "array-contains", userRef).onSnapshot((groupsSnapshot) => {
                const groups = groupsSnapshot.docs;
                console.log("Groups length:" + groups.length)
                groups.forEach(async (group, index) => {
                    const groupMembers: any[] = group.data()['group_members'];
                    console.log("groupMembers length:" + groupMembers.length)
                    let newGroupMembers: any[] = [];
                    console.log("Path: " + userRef.path + " 2: " + groupMembers[0].path)
                    newGroupMembers = await groupMembers.filter(rec => {
                        console.log("User path: " + userRef.path)
                        console.log("rec path: " + rec.path)
                        return (userRef.path !== rec.path)
                    })
                    console.log("Group members count: " + newGroupMembers.length)
                    writeBatch.update(group.ref, {'group_members': newGroupMembers});

                    console.log("Index: " + index + " group length: " + groupMembers.length)
                    if(index == (groupMembers.length - 1)){
                        writeBatch.commit().then( data => {
                            console.log("Done deleting user associated data");
                            
                        }).catch(error => {
                            alert('Error while assigning OJT');
                            console.log(error);
                        });
                    }
                });
                
            }, (err) => {
                console.log("Error fetching documents" + err);
            });

        }, (err) => {
            console.log("Error fetching documents")
        });

});