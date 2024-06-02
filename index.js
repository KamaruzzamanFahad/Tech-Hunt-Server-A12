const express = require('express');
const app = express();
const port = process.env.PORT | 3000;
require('dotenv').config();
const cors = require('cors');
const jwt = require('jsonwebtoken');
//middleware
app.use(cors());
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
    // const cartcollection = db.collection('cart');
    const usercollection = db.collection('user');
    // const paymentcollection = db.collection('payment');

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

    // app.get('/menu', async (req, res) => {
    //   const menu = await menucollection.find().toArray();
    //   res.send(menu);
    // });
    app.post('/addproduct', verigytoken, verifyAdmin, async (req, res) => {
      const doc = req.body;
      const result = await productcollection.insertOne(doc);
      res.send(result);
    });
    // app.delete('/menu', verigytoken, verifyAdmin, async (req, res) => {
    //   const id = req.query.id;
    //   const filter = { _id: new ObjectId(id) };
    //   const result = await menucollection.deleteOne(filter);
    //   res.send(result);
    // });
    // app.patch('/menu', async (req, res) => {
    //   const quiry = { _id: new ObjectId(req.query.id) };
    //   const doc = req.body;
    //   const update = {
    //     $set: doc,
    //   };
    //   const result = await menucollection.updateOne(quiry, update);
    //   res.send(result);
    // });

    // //cart collection
    // app.get('/carts', async (req, res) => {
    //   const email = req.query.email;
    //   const quary = { email: email };
    //   const result = await cartcollection.find(quary).toArray();
    //   res.send(result);
    // });
    // app.post('/carts', verigytoken, async (req, res) => {
    //   const data = req.body;
    //   const result = await cartcollection.insertOne(data);
    //   res.send(result);
    // });
    // app.delete('/carts', async (req, res) => {
    //   const id = req.query.id;
    //   const quary = { _id: new ObjectId(id) };
    //   const result = await cartcollection.deleteOne(quary);
    //   res.send(result);
    // });

    // //payment collection
    // app.get('/paymenthistry', verigytoken, async (req, res) => {
    //   const email = req.query.email;
    //   if (email != req.decoded.email) {
    //     res.status(401).send('forbidden asses');
    //   }
    //   const quary = { email: email };
    //   const result = await paymentcollection.find(quary).toArray();
    //   res.send(result);
    //   console.log(email);
    // });
    // app.post('/payment', async (req, res) => {
    //   const doc = req.body;
    //   const paymentresult = await paymentcollection.insertOne(doc);

    //   // delet many
    //   const delquary = {
    //     _id: {
    //       $in: doc.cartIds.map((itemid) => new ObjectId(itemid)),
    //     },
    //   };
    //   const deletresuult = await cartcollection.deleteMany(delquary);
    //   res.send({ paymentresult, deletresuult });
    // });

    // user collection
    app.get('/users/admin/:email', verigytoken, async (req, res) => {
      const email = req.params.email;
      const decodedemail = req.decoded.email;
      if (email != decodedemail) {
        res.status(401).send('forbiddin acces');
      }
      const quary = { email: email };
      const result = await usercollection.findOne(quary);
      if (result?.role == 'admin') {
        res.send(true);
      } else {
        res.send(false);
      }
    });

    app.get('/users', verigytoken, verifyAdmin, async (req, res) => {
      const result = await usercollection.find().toArray();
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
      res.send('useralready')
    });
    // app.delete('/users', verigytoken, verifyAdmin, async (req, res) => {
    //   const id = req.query.id;
    //   const filter = { _id: new ObjectId(id) };
    //   const result = await usercollection.deleteOne(filter);
    //   res.send(result);
    // });
    // app.patch(
    //   '/users/admin/:id',
    //   verigytoken,
    //   verifyAdmin,
    //   async (req, res) => {
    //     const id = req.params.id;
    //     const quary = { _id: new ObjectId(id) };
    //     const updatedoc = {
    //       $set: {
    //         role: 'admin',
    //       },
    //     };
    //     const result = await usercollection.updateOne(quary, updatedoc);
    //     res.send(result);
    //   }
    // );

    // // admin statistics
    // app.get('/adminstatistics', verigytoken, verifyAdmin, async (req, res) => {
    //   const customer = await usercollection.estimatedDocumentCount();
    //   const product = await menucollection.estimatedDocumentCount();
    //   const order = await paymentcollection.estimatedDocumentCount();

    //   const result = await paymentcollection
    //     .aggregate([
    //       {
    //         $group: {
    //           _id: null,
    //           totalRevinew: { $sum: '$price' },
    //         },
    //       },
    //     ])
    //     .toArray();

    //   const revinew = result.length > 0 ? result[0].totalRevinew : 0;

    //   res.send({
    //     customer,
    //     product,
    //     order,
    //     revinew,
    //   });
    // });

    // app.get('/orderstats',verigytoken,verifyAdmin, async (req, res) => {
    //   const result = await paymentcollection
    //     .aggregate([
    //       {
    //         $unwind: '$menuIds',
    //       },
    //       {
    //         $lookup: {
    //           from: 'menu',
    //           localField: 'menuIds',
    //           foreignField: '_id',
    //           as: 'menuitems',
    //         },
    //       },
    //       {
    //         $unwind: '$menuitems',
    //       },
    //       {
    //         $group: {
    //           _id: '$menuitems.category',
    //           quntity: {$sum: 1},
    //           rebenue: {$sum: '$menuitems.price'}
    //         },
    //       },
    //     ])
    //     .toArray();
    //   res.send(result);
    // });

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  console.log('server running');
  res.send('server is running');
});

app.listen(port, () => {
  console.log('server running port:', port);
});
