const stripe = require('stripe')(process.env.STRIPE_PRIVATE_KEY);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const data = JSON.parse(event.body);

        // We capture the Cloudinary image links created by the frontend
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'gbp',
                        product_data: {
                            name: `Customised Card (${data.name || 'Custom'})`,
                            description: 'A4 Personalised Greeting Card folded to A5',
                        },
                        unit_amount: 349, // £3.49
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${process.env.URL || 'http://localhost:8888'}/?status=success`,
            cancel_url: `${process.env.URL || 'http://localhost:8888'}/?status=cancel`,
            
            // Attaching the exact, finished A4 landscape spreads to your Stripe dashboard!
            metadata: {
                custom_name: data.name || "N/A",
                custom_age: data.age || "N/A",
                PRINT_OUTSIDE_SPREAD: data.outsideImageUrl || "No Image",
                PRINT_INSIDE_SPREAD: data.insideImageUrl || "No Image"
            }
        });

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: session.url }),
        };
    } catch (error) {
        console.error("Stripe Session Error:", error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message }),
        };
    }
};
