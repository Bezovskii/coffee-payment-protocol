// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function balanceOf(address owner) external view returns (uint256);

    function allowance(
        address owner,
        address spender
    ) external view returns (uint256);

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external returns (bool);

    function transfer(address to, uint256 value) external returns (bool);
}

contract CoffeeShopEscrow {
    event OrderPlaced(
        uint256 indexed orderId,
        address indexed customer,
        uint256 indexed itemId,
        uint256 qty,
        uint256 total
    );

    event OrderWithdrawn(
        uint256 indexed orderId,
        address indexed to,
        uint256 total
    );
    event OrderRefunded(
        uint256 indexed orderId,
        address indexed customer,
        uint256 total
    );

    event ItemCreated(
        uint256 indexed itemId,
        string name,
        uint256 price,
        bool active
    );
    event ItemUpdated(
        uint256 indexed itemId,
        string name,
        uint256 oldPrice,
        uint256 newPrice,
        bool active
    );
    event ItemStatusUpdated(uint256 indexed itemId, bool active);
    event StoreWalletUpdated(
        address indexed oldWallet,
        address indexed newWallet
    );
    event SalesPaused(bool paused);

    address public immutable owner;
    address public storeWallet;
    IERC20 public immutable usdt;

    uint256 public nextOrderId = 1;
    uint256 public nextItemId = 1;
    bool public paused;

    enum Status {
        NONE,
        PAID,
        WITHDRAWN,
        REFUNDED
    }

    struct Order {
        address customer;
        uint256 itemId;
        uint256 qty;
        uint256 total;
        Status status;
    }

    struct Item {
        string name;
        uint256 price;
        bool active;
        bool exists;
    }

    mapping(uint256 => Item) private items;
    mapping(uint256 => Order) public orders;

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier notPaused() {
        require(!paused, "sales paused");
        _;
    }

    constructor(address _storeWallet, address _usdt) {
        require(_storeWallet != address(0), "zero store wallet");
        require(_usdt != address(0), "zero token");

        owner = msg.sender;
        storeWallet = _storeWallet;
        usdt = IERC20(_usdt);
    }

    function setStoreWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "zero store wallet");

        address oldWallet = storeWallet;
        storeWallet = newWallet;

        emit StoreWalletUpdated(oldWallet, newWallet);
    }

    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit SalesPaused(value);
    }

    function createItem(
        string calldata name,
        uint256 price,
        bool active
    ) external onlyOwner returns (uint256 itemId) {
        require(bytes(name).length > 0, "name empty");
        require(price > 0, "price must be > 0");

        itemId = nextItemId++;

        items[itemId] = Item({
            name: name,
            price: price,
            active: active,
            exists: true
        });

        emit ItemCreated(itemId, name, price, active);
    }

    function updateItem(
        uint256 itemId,
        string calldata name,
        uint256 newPrice,
        bool active
    ) external onlyOwner {
        Item storage it = items[itemId];

        require(it.exists, "item not found");
        require(bytes(name).length > 0, "name empty");
        require(newPrice > 0, "price must be > 0");

        uint256 oldPrice = it.price;

        it.name = name;
        it.price = newPrice;
        it.active = active;

        emit ItemUpdated(itemId, name, oldPrice, newPrice, active);
    }

    function setPrice(uint256 itemId, uint256 newPrice) external onlyOwner {
        Item storage it = items[itemId];

        require(it.exists, "item not found");
        require(newPrice > 0, "price must be > 0");

        uint256 oldPrice = it.price;
        it.price = newPrice;

        emit ItemUpdated(itemId, it.name, oldPrice, newPrice, it.active);
    }

    function setItemActive(uint256 itemId, bool active) external onlyOwner {
        Item storage it = items[itemId];

        require(it.exists, "item not found");

        it.active = active;

        emit ItemStatusUpdated(itemId, active);
    }

    function getItem(
        uint256 itemId
    )
        external
        view
        returns (string memory name, uint256 price, bool active, bool exists)
    {
        Item storage it = items[itemId];
        return (it.name, it.price, it.active, it.exists);
    }

    function getMenuSize() external view returns (uint256) {
        return nextItemId - 1;
    }

    function buy(uint256 itemId, uint256 qty) external notPaused {
        require(qty > 0, "qty must be > 0");

        Item storage it = items[itemId];
        require(it.exists, "item not found");
        require(it.active, "item not for sale");

        uint256 total = it.price * qty;
        address customer = msg.sender;

        require(usdt.balanceOf(customer) >= total, "not enough USDT");
        require(
            usdt.allowance(customer, address(this)) >= total,
            "allowance too low"
        );

        bool ok = usdt.transferFrom(customer, address(this), total);
        require(ok, "transfer failed");

        uint256 orderId = nextOrderId++;

        orders[orderId] = Order({
            customer: customer,
            itemId: itemId,
            qty: qty,
            total: total,
            status: Status.PAID
        });

        emit OrderPlaced(orderId, customer, itemId, qty, total);
    }

    function withdraw(uint256 orderId) external onlyOwner {
        Order storage o = orders[orderId];

        require(o.status == Status.PAID, "order not withdrawable");

        o.status = Status.WITHDRAWN;

        bool ok = usdt.transfer(storeWallet, o.total);
        require(ok, "transfer failed");

        emit OrderWithdrawn(orderId, storeWallet, o.total);
    }

    function refund(uint256 orderId) external {
        Order storage o = orders[orderId];

        require(o.status == Status.PAID, "order not refundable");
        require(msg.sender == o.customer, "not customer");

        o.status = Status.REFUNDED;

        bool ok = usdt.transfer(o.customer, o.total);
        require(ok, "transfer failed");

        emit OrderRefunded(orderId, o.customer, o.total);
    }
}
