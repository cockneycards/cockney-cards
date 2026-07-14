// netlify/functions/create-checkout.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { name, age, insideTop, insideMiddle, insideBottom } = JSON.parse(event.body);

    // Create a Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: 'Customised Augusta Golfing Birthday Card',
              description: `Front: ${name} (Age ${age})`,
            },
            unit_amount: 349, // £3.49 in pence
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // We save the custom text here so it shows up on your Stripe Dashboard order!
      metadata: {
        custom_name: name,
        custom_age: age,
        inside_top: insideTop,
        inside_middle: insideMiddle,
        inside_bottom: insideBottom
      },
      success_url: `${process.env.URL}/index.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL}/index.html`,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ id: session.id, url: session.url }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
