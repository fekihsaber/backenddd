const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');


const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect('mongodb+srv://saberfekih44:tTe2fJo4c6ekJyOZ@cluster0.wrjcc.mongodb.net/first')
    .then(() => console.log('Connected to MongoDB'))
    .catch((error) => console.log('Error:', error));

app.get('/', (req, res) => {
    res.send('Express App is running.');
});

const storage = multer.diskStorage({
    destination: './upload/images',
    filename: (req, file, cb) => {
        return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage: storage });

app.use('/images', express.static('upload/images'));

app.post('/upload', upload.single('product'), (req, res) => {
    res.json({
        success: 1,
        image_url: `http://localhost:4000/images/${req.file.filename}`
    });
});

const Product = mongoose.model('Product', {
    id: {
        type: Number,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    new_price: {
        type: Number,
        required: true
    },
    old_price: {
        type: Number,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    available: {
        type: Boolean,
        default: true
    }
});

app.post('/addproduct', async (req, res) => {
    let products = await Product.find({});
    let id;

    if (products.length > 0) {
        let lastProduct = products[products.length - 1];
        id = lastProduct.id + 1;
    } else {
        id = 1;
    }

    const category = req.body.category.trim();
    if (!category) {
        return res.status(400).json({ success: false, message: 'Category is required.' });
    }

    const product = new Product({
        id: id,
        name: req.body.name,
        image: req.body.image,
        category: category,
        new_price: req.body.new_price,
        old_price: req.body.old_price
    });

    try {
        await product.save();
        console.log('Saved');
        res.json({
            success: true,
            name: req.body.name
        });
    } catch (error) {
        console.error('Error saving product:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add product'
        });
    }
});

app.post('/removeproduct', async (req, res) => {
    await Product.findOneAndDelete({ id: req.body.id });
    console.log('Removed');
    res.json({
        success: true,
        name: req.body.name
    });
});

app.get('/allproducts', async (req, res) => {
    let products = await Product.find({});
    console.log('All products found');
    res.send(products);
});

app.get('/searchandfilter', async (req, res) => {
    try {
        const { searchTerm = '', category = 'All' } = req.query;

        const query = {};
        if (searchTerm) {
            query.name = new RegExp(searchTerm, 'i'); 
        }
        if (category && category !== 'All') {
            query.category = category;
        }

        const products = await Product.find(query);
        console.log('Filtered products found');
        res.json(products);
    } catch (error) {
        console.error('Error fetching filtered products:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch filtered products' });
    }
});

app.get('/dashboard', async (req, res) => {
    try {
        const totalProducts = await Product.countDocuments();
        const totalUsers = await Users.countDocuments(); 
        const products = await Product.find({}).limit(5).sort({ date: -1 });
        res.json({
            totalProducts,
            totalUsers,
            latestProducts: products
        });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch dashboard data' });
    }
});

const Users = mongoose.model('Users', {
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    cartData: {
        type: Object,
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    date: {
        type: Date,
        default: Date.now,
    }
});

app.post('/signup' , async (req,res) => {
    let check = await Users.findOne({email:req.body.email});
    if (check){
        return res.status(400).json({success:false, error :'existing user with this email'})
    }
    let cart = {};
    for (i = 0 ; i < 300 ; i++){
        cart[i]=0;
    }
    const user = new Users ({
        name:req.body.name,
        email:req.body.email,
        password:req.body.password,
        cartData:cart
    })
    await user.save();
    const data = {
        user:{
            id:user.id
        }
    }
    const token = jwt.sign(data,'secret_ecomm');
    res.json({success:true,token})
})

app.post('/login', async (req,res) => {
    let user = await Users.findOne({email:req.body.email});
    if(user){
        const comparePass = req.body.password === user.password ;
        if (comparePass){
            const data = {
                user:{
                    id:user.id
                }
            }
            const token = jwt.sign(data,'secret_ecomm');
            res.json({success:true,token})

        }else{
            res.json({success:false,error:'wrong password'})
        }
    } else {
        res.json({success:false, error:'wrong email id '})
    }
})


const authenticate = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: 'No token provided' });
    }

    jwt.verify(token, 'secret_ecom', (err, decoded) => {
        if (err) {
            return res.status(401).json({ success: false, message: 'Invalid token' });
        }

        req.user = decoded.user; 
        next();
    });
};

const isAdmin = (req, res, next) => {
    const userId = req.user.id;
    Users.findById(userId)
        .then(user => {
            if (user && user.isAdmin) { 
                next();
            } else {
                res.status(403).json({ success: false, message: 'Access denied.' });
            }
        })
        .catch(error => {
            console.error('Error verifying admin:', error);
            res.status(500).json({ success: false, message: 'Error verifying admin' });
        });
};

app.post('/updateprice', authenticate, isAdmin, async (req, res) => {
    const { id, new_price } = req.body;

    try {
        const product = await Product.findOneAndUpdate({ id }, { new_price }, { new: true });
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        res.json({ success: true, product });
    } catch (error) {
        console.error('Error updating product price:', error);
        res.status(500).json({ success: false, message: 'Failed to update product price' });
    }
});



app.get('/user', authenticate, async (req, res) => {
    try {
        const user = await Users.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            user
        });
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch user details' });
    }
});

app.get('/users' , async (req,res) => {
    const users = await Users.find({});
    console.log('users from db',users);
    res.send(users);
})

app.post('/updatecart', authenticate, async (req, res) => {
    const { cartData } = req.body;

    try {
        const user = await Users.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.cartData = cartData;
        await user.save();

        res.json({
            success: true,
            message: 'Cart updated successfully'
        });
    } catch (error) {
        console.error('Error updating cart:', error);
        res.status(500).json({ success: false, message: 'Failed to update cart' });
    }
});

app.get('/cart', authenticate, async (req, res) => {
    try {
        const user = await Users.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            cartData: user.cartData
        });
    } catch (error) {
        console.error('Error fetching cart data:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch cart data' });
    }
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

const PORT =  4000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
