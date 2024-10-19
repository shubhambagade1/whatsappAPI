require('dotenv').config();
const bodyParser = require('body-parser');
const axios = require('axios');

// Middleware to parse the body
const parseBody = (req, res) => {
    return new Promise((resolve, reject) => {
        bodyParser.json()(req, res, (err) => {
            if (err) return reject(err);
            resolve(req.body);
        });
    });
};

const handler = async (req, res) => {
    // Parse the body
    const jsonBody = await parseBody(req, res);

    // Verify the webhook
    if (req.method === 'GET') {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode && token) {
            if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
                console.log('Webhook verified successfully!');
                return res.status(200).send(challenge);
            } else {
                return res.status(403).send('Forbidden');
            }
        }
    }

    // Handle incoming messages
    if (req.method === 'POST') {
        console.log('Webhook received:', JSON.stringify(jsonBody, null, 2));

        // Acknowledge receipt of the event
        res.status(200).send('EVENT_RECEIVED');

        // Extract the message and sender information
        const messagingEvent = jsonBody.entry[0].changes[0].value.messages[0];

        if (!messagingEvent) {
            console.log('No messaging event found');
            return;
        }

        const senderId = messagingEvent.from;

        // Handle text message responses
        if (messagingEvent.text) {
            const messageText = messagingEvent.text.body.toLowerCase();
            console.log(`Received text message "${messageText}" from ${senderId}`);

            if (messageText === 'hi' || messageText === 'hello') {
                console.log(`Sending interactive message to ${senderId}`);
                await sendInteractiveMessage(senderId);
            } else {
                console.log('Sending default response');
                await sendMessage(senderId, 'Please send "hi" to start the conversation.');
            }
        }

        // Handle interactive message button replies
        if (messagingEvent.interactive && messagingEvent.interactive.button_reply) {
            const buttonPayload = messagingEvent.interactive.button_reply.id;
            console.log(`Received interactive button reply "${buttonPayload}" from ${senderId}`);
            await followUpQuestion(senderId, buttonPayload);
        }
    } else {
        // Handle unsupported request methods
        res.status(405).send('Method Not Allowed');
    }
};

// Function to send an interactive message
const sendInteractiveMessage = async (recipientId) => {
    try {
        const response = await axios.post(`https://graph.facebook.com/v12.0/${process.env.PHONE_NUMBER_ID}/messages`, {
            messaging_product: 'whatsapp',
            to: recipientId,
            type: 'interactive',
            interactive: {
                type: 'button',
                header: {
                    type: 'text',
                    text: 'Choose an option',
                },
                body: {
                    text: 'Please select one of the following options:',
                },
                footer: {
                    text: 'You can choose one of the options below.',
                },
                action: {
                    buttons: [
                        { type: 'reply', reply: { id: '1', title: 'Option 1' } },
                        { type: 'reply', reply: { id: '2', title: 'Option 2' } },
                        { type: 'reply', reply: { id: '3', title: 'Option 3' } },
                    ],
                },
            },
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
        });

        console.log('Interactive message sent successfully:');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
        if (error.response) {
            console.error('Error sending interactive message:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
};

// Function to ask a follow-up question based on button selection
const followUpQuestion = async (recipientId, selectedOption) => {
    let followUpText;

    switch (selectedOption) {
        case '1':
            followUpText = 'You selected Option 1. What would you like to know about this option?';
            break;
        case '2':
            followUpText = 'You selected Option 2. Can you specify what you are interested in?';
            break;
        case '3':
            followUpText = 'You selected Option 3. Please tell me more about your needs.';
            break;
        default:
            followUpText = 'Please choose a valid option.';
            break;
    }

    await sendMessage(recipientId, followUpText);
};

// Function to send a text message
const sendMessage = async (recipientId, message) => {
    try {
        const response = await axios.post(`https://graph.facebook.com/v12.0/${process.env.PHONE_NUMBER_ID}/messages`, {
            messaging_product: 'whatsapp',
            to: recipientId,
            text: { body: message },
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
        });

        console.log('Message sent successfully:');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
        if (error.response) {
            console.error('Error sending message:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
};

// Export the handler for Vercel
module.exports = handler;
