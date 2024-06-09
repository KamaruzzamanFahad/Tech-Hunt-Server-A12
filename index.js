const express = require('express');
const app = express();
const port = process.env.PORT | 3000;
require('dotenv').config();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIP_SECRET);
//middleware
//Must remove "/" from your production URL
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://techhunt-9cacf.web.app",
      "https://techhunt-9cacf.firebaseapp.com",
    ]
  })
);
app.use(express.json());
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.USER}:${process.env.PASS}@cluster0.otpbube.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// verify token middleware
const verigytoken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).send({ massage: 'forbiddin acces' });
  } else {
    jwt.verify(
      token,
      process.env.ACCES_TOKEN_SECRECT,
      function (error, decoded) {
        if (error) {
          return res.status(401).send({ massage: 'forbiddin acces' });
        }
        if (decoded) {
          req.decoded = decoded;
          next();
        }
      }
    );
  }
};

async function run() {
  try {
    //auth releted api
    app.post('/jwt', async (req, res) => {
      const payload = req.body;
      const token = jwt.sign(payload, process.env.ACCES_TOKEN_SECRECT, {
        expiresIn: '73h',
      });
      res.send(token);
    });

    const db = client.db('TechHunt');
    const productcollection = db.collection('product');
    const reportcollection = db.collection('ReportedProduct');
    const reviewcollection = db.collection('review');
    const usercollection = db.collection('user');
    const paymentcollection = db.collection('payment');
    const cuponcollection = db.collection('cupon');

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const quary = { email: email };
      const result = await usercollection.findOne(quary);
      if (result.role == 'admin') {
        next();
      } else {
        res.status(401).send('forbiddin acces');
      }
    };

    const verifyModerator = async (req, res, next) => {
      const email = req.decoded.email;
      const quary = { email: email };
      const result = await usercollection.findOne(quary);
      if (result.role == 'moderator') {
        next();
      } else {
        res.status(401).send('forbiddin acces');
      }
    };

    app.get('/statistics', verigytoken, verifyAdmin, async (req, res) => {
      const products = await productcollection.estimatedDocumentCount()
      const reviews = await reviewcollection.estimatedDocumentCount()
      const users = await usercollection.estimatedDocumentCount()
      const chartData = [
        { name: 'Products', value: products },
        { name: 'Reviews', value: reviews },
        { name: 'Users', value: users }
      ];
      res.send(chartData)
    })

    app.get('/productcount', async (req, res) => {
      const filter = { Status: { $in: ['featured', 'accepted'] } };
      const count = await productcollection.countDocuments(filter);
      res.send({ count });
    })
    app.get('/productsbysize', async (req, res) => {
      const text = req.query.text;
      const query = text ? { Status: { $in: ['featured', 'accepted',] }, Tags: { $regex: new RegExp(text, 'i') } } : { Status: { $in: ['featured', 'accepted',] } }
      const skip = req.query.skip;
      const limit = req.query.limit;
      const result = await productcollection.find(query).skip(parseInt(skip)).limit(parseInt(limit)).toArray();
      res.send(result);
    });
    app.get('/products', async (req, res) => {
      const filter = { Status: { $in: ['featured', 'accepted'] } };
      const result = await productcollection.find(filter).toArray();
      res.send(result);
    });
    app.get('/pendingproducts', verigytoken, verifyModerator, async (req, res) => {
      const filter = { Status: { $in: ['pending', 'featured', 'accepted', 'rejected'] } };

      const result = await productcollection.find(filter).toArray();

      result.sort((a, b) => {
        const order = ['pending', 'featured', 'accepted', 'rejected'];
        return order.indexOf(a.Status) - order.indexOf(b.Status);
      });

      res.send(result);

    });
    app.get('/latestproduct', async (req, res) => {
      const filter = { Status: 'featured' };
      const result = await productcollection.find(filter).sort({ Time: -1 }).limit(4).toArray();
      res.send(result);
    });
    app.get('/tranding-tproduct', async (req, res) => {
      const filter = { Status: { $in: ['accepted', 'featured'] } };
      const result = await productcollection.aggregate([
        { $match: filter },
        { $addFields: { votesLength: { $size: "$votes" } } },
        { $sort: { votesLength: -1 } },
        { $limit: 6 }
      ]).toArray();

      res.send(result);
    });
    app.patch('/product-status-update', verigytoken, verifyModerator, async (req, res) => {
      const status = req.body.status;
      const id = req.body.id;
      const filter = { _id: new ObjectId(id) }
      updatdoc = {
        $set: {
          Status: status,
        }
      }
      const result = await productcollection.updateOne(filter, updatdoc)
      res.send(result)
    })
    app.get('/singleproduct', verigytoken, async (req, res) => {
      const id = req.query.id;
      const query = { _id: new ObjectId(id) };
      const result = await productcollection.findOne(query);
      res.send(result);
    });
    app.get('/myproduct', verigytoken, async (req, res) => {
      const email = req.query.email;
      const quiry = { OwnerEmail: email };
      const result = await productcollection.find(quiry).toArray();
      res.send(result);
    });
    app.post('/addproduct', verigytoken, async (req, res) => {
      const doc = req.body;
      const result = await productcollection.insertOne(doc);
      res.send(result);
    });


    app.post('/add-product-review', verigytoken, async (req, res) => {
      // const id = req.query.id;
      const doc = req.body;
      // const filter = { _id: new ObjectId(id) }
      // const newdocument = {
      //   $addToSet: {
      //     Reviews: doc,
      //   }
      // }
      // const result = await productcollection.updateOne(filter, newdocument)
      const result = await reviewcollection.insertOne(doc)
      res.send(result)
    })

    app.get('/reviews', verigytoken, async (req, res) => {
      const id = req.query.id;
      const query = { productid: id }
      const result = await reviewcollection.find(query).toArray()
      res.send(result)
    })



    app.patch('/updateproduct', verigytoken, async (req, res) => {
      const id = req.query.id;
      const doc = req.body;
      const updatedoc = {
        $set: {
          name: doc.name,
          detils: doc.detils,
          ProductLink: doc.ProductLink,
          OwnerName: doc.OwnerName,
          OwnerEmail: doc.OwnerEmail,
          OwnerImage: doc.OwnerImage,
          image: doc.image,
          Tags: doc.Tags,
          Time: doc.Time,
          Status: doc.Status,
          votes: doc.votes,
        },
      };
      const quary = { _id: new ObjectId(id) };
      const result = await productcollection.updateOne(quary, updatedoc);
      res.send(result);
    });
    app.patch('/upvote', verigytoken, async (req, res) => {
      const doc = req.body;
      const productId = doc.id;
      const email = doc.email;

      try {
        // Check if the email already exists in the vote array
        const product = await productcollection.findOne({ _id: new ObjectId(productId), votes: email });

        if (product) {
          // Email exists, so remove it from the vote array
          const removeResult = await productcollection.updateOne(
            { _id: new ObjectId(productId) },
            { $pull: { votes: email } }
          );

          if (removeResult.modifiedCount === 1) {
            return res.status(200).send({ message: 'Email removed from vote array' });
          } else {
            return res.status(500).send({ message: 'Failed to remove email from vote array' });
          }
        } else {
          // Email does not exist, so add it to the vote array
          const addResult = await productcollection.updateOne(
            { _id: new ObjectId(productId) },
            { $addToSet: { votes: email } }
          );

          if (addResult.modifiedCount === 1) {
            return res.status(200).send({ message: 'Email added to vote array' });
          } else {
            return res.status(500).send({ message: 'Failed to add email to vote array' });
          }
        }
      } catch (error) {
        res.status(500).send({ message: 'An error occurred', error });
      }
    });


    app.delete('/deletmyproduct', verigytoken, async (req, res) => {
      const id = req.query.id;
      const filter = { _id: new ObjectId(id) };
      const result = await productcollection.deleteOne(filter);
      res.send(result);
    });

    //report collection
    app.get('/report', verigytoken, verifyModerator, async (req, res) => {
      const result = await reportcollection.find().toArray();
      res.send(result)
    })
    app.delete('/report', verigytoken, verifyModerator, async (req, res) => {
      const id = req.query.id;
      const filter = { _id: new ObjectId(id) };
      const result = await reportcollection.deleteOne(filter);
      res.send(result)
    })
    app.post('/report', verigytoken, async (req, res) => {
      const id = req.body.id;
      const name = req.body.name;
      const email = req.body.email;
      const doc = {
        reportedProductName: name,
        reportedProductId: id,
        reportermail: email,
      }
      const reportresult = await reportcollection.insertOne(doc)

      const filter = { _id: new ObjectId(id) }
      const reportdoc = {
        $addToSet: {
          Report: email,
        }
      }
      const productresult = await productcollection.updateOne(filter, reportdoc)
      res.send({ reportresult, productresult })
    })



    //payment intent
    app.post('/create-payment-intent', verigytoken, async (req, res) => {
      const price = req.body.price;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: parseInt(price * 100),
        currency: 'usd',
        payment_method_types: ['card'],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });


    app.post('/payment', verigytoken, async (req, res) => {
      const doc = req.body;
      const paymentresult = await paymentcollection.insertOne(doc);
      res.send(paymentresult)
    })
    app.get('/payment', verigytoken, async (req, res) => {
      const email = req.query.email;
      const quiry = { email: email }
      const result = await paymentcollection.findOne(quiry)
      res.send(result)
    })


    // user collection

    app.patch('/user-role-update', verigytoken, verifyAdmin, async (req, res) => {
      const role = req.body.role;
      const id = req.body.id;
      const filter = { _id: new ObjectId(id) }
      updatdoc = {
        $set: {
          role: role,
        }
      }
      const result = await usercollection.updateOne(filter, updatdoc)
      res.send(result)
    })

    app.get('/users', verigytoken, verifyAdmin, async (req, res) => {
      const result = await usercollection.find().toArray();
      res.send(result);
    });

    app.get('/user', verigytoken, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await usercollection.findOne(query)
      res.send(result);
    });

    app.post('/users', async (req, res) => {
      const data = req.body;
      const email = data.email;
      const query = { email: email };
      const isuser = await usercollection.findOne(query);
      if (!isuser) {
        const result = await usercollection.insertOne(data);
        res.send(result);
      }
      res.send('useralready');
    });


    //cuponcollection
    app.post('/cupon-add', verigytoken, verifyAdmin, async (req, res) => {
      const doc = req.body;
      const result = await cuponcollection.insertOne(doc);
      res.send(result)
    })

    app.get('/cupon', async (req, res) => {
      const result = await cuponcollection.find().toArray()
      res.send(result)
    })

    app.patch('/cupon-update', verigytoken, verifyAdmin, async (req, res) => {
      const id = req.query.id;
      const doc = req.body;
      const filter = { _id: new ObjectId(id) }
      const updatdoc = {
        $set: doc,
      }
      const result = await cuponcollection.updateOne(filter, updatdoc)
      res.send(result)

    })
    app.get('/discount', verigytoken, async (req, res) => {
      const copun = req.query.coupon;
      const filter = { CouponCode: copun }
      const result = await cuponcollection.findOne(filter)
      if (result == null) {
        res.send({ massage: 'Invalid Coupon Please Enter a Valid Coupon' })
      } else {
        const curerntdate = Date.now()
        const coupondate = new Date(result.ExpiryDate)
        if (curerntdate < coupondate) {
          res.send({ dis: result.DiscountAmount })
        } else {
          res.send({ massage: 'Coupon Date Expired' })
        }
      }

    })

    app.delete('/deletecopun', verigytoken, verifyAdmin, async (req, res) => {
      const id = req.query.id;
      const filter = { _id: new ObjectId(id) }
      const result = await cuponcollection.deleteOne(filter);
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    // await client.db('admin').command({ ping: 1 });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('server is running');
});

app.listen(port, () => {
  console.log('server running port:', port);
});
