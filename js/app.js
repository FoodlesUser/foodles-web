document.addEventListener('DOMContentLoaded', () => {
    //Unpkg imports
    const Web3Modal = window.Web3Modal.default
    const WalletConnectProvider = window.WalletConnectProvider.default
    const CONTRACTS = {
        4: {
            FC: '0x6F7b08152c00D7D61294346E2C82a5f6Ff78c65A',
        },
        1: {
            FC: '0xa8005fB2278E7B34F4D25ec1d8308690711DFD3B',
        },
    }

    // fc ABI
    let fcContractABI
    fetch("./abis/FoodlesClubToken.json")
        .then(response => {
            return response.json()
        })
        .then(data => fcContractABI = data)

    let fcContract
    let provider

    const providerOptions = {
        walletconnect: {
            package: WalletConnectProvider,
            options: {
                infuraId: '240248d1c65143c082ae6b411905d45a',
            },
        },
    }

    let web3Modal = new Web3Modal({
        cacheProvider: false, // optional
        providerOptions, // required
        disableInjectedProvider: false, // optional. For MetaMask / Brave / Opera.
    })

    // Update message
    let renderMessage = (message) => {
        let messageEl = document.getElementById('message')
        messageEl.innerHTML = message
    }

    let connectWalletBtn = document.getElementById("wallet-connect")
    connectWalletBtn.addEventListener("click", async () => {
        connectWalletBtn.classList.add("hidden")
        await window.Web3Modal.removeLocal('walletconnect')
        try {
            provider = await web3Modal.connect()
            provider = new ethers.providers.Web3Provider(provider)
            renderMessage('Loading...')
            provider.on("network", updateNetwork)
        } catch (err) {
            connectWalletBtn.classList.remove("hidden")
            const msg = 'Could not get a wallet connection'
            console.log(msg, err)
            renderMessage(msg)
        }
    })

    let mintBtn = document.getElementById("mint-btn")
    mintBtn.addEventListener("click", async () => {
        mintBtn.setAttribute("disabled", "")

        let quantityPaidFor = await getQuantity()
        let quantityReceived = await getQuantityWithFree()
        let freeClaim = document.getElementById("free-switch").checked
        try {
            const tx = await fcContract.functions.mint(quantityReceived, freeClaim, {
                value: (await fcContract.functions.tokenPrice())[0].mul(quantityPaidFor)
            });

            renderMessage('Waiting for confirmation...')
            await tx.wait()

            document.getElementById("success-message").innerText = `You just minted ${quantityReceived} Female Doodles Club tokens.`
            document.getElementById("sale").classList.add("hide")
            document.getElementById("minted").classList.remove("hide")
            renderMessage('')
        } catch (err){
            console.log(err)
        }
    })

    let quantityInput = document.getElementById("quantity")
    quantityInput.addEventListener("change", async () => {
        updateMintButton()
    })

    let freeSwitch = document.getElementById("free-switch")
    freeSwitch.addEventListener("change", async () => {
        updateMintButton()
    })

    // get contract
    const updateNetwork = async (network) => {
        if (CONTRACTS[network.chainId]) {
            document.getElementById("connect").classList.add("hide")

            const fcContractId = CONTRACTS[network.chainId].FC

            if (!fcContractId) {
                document.getElementById("countdown").classList.remove("hide")
                renderMessage('')
                return
            }
            const signer = provider.getSigner()
            fcContract = new ethers.Contract(fcContractId, fcContractABI, signer)

            let saleEnabled = (await fcContract.functions.saleEnabled())[0]
            if (saleEnabled) {
                document.getElementById("sale").classList.remove("hide")
            } else {
                document.getElementById("countdown").classList.remove("hide")
                renderMessage('')
                return
            }

            let claim = await fcContract.functions.saleClaims()

            let maxSupply = claim[0][0].toNumber()
            let currentlyMinted = claim[0][1].toNumber()
            let freeClaimed = claim[0][3].toNumber()

            document.getElementById("meterspan").style.width = (currentlyMinted / maxSupply * 100) + "%"
            // total supply
            if (currentlyMinted < maxSupply) {
                document.getElementById("fcs-left").innerHTML = `${maxSupply - currentlyMinted} Foodles left`

                // free supply
                document.getElementById("free-left").innerHTML = `${700 - freeClaimed} / 700 left`
                if (freeClaimed == 700) { //disable because run out
                    document.getElementById("free-switch").setAttribute("disabled", "")
                }

                // update mint button with minting prices
                updateMintButton()
            } else {
                // sold out
                document.getElementById("soldout").classList.remove("hide")
                document.getElementById("sale").classList.add("hide")
            } 

            renderMessage('')
        }
    }

    let getQuantity = async () => {
        return parseInt(document.getElementById('quantity').value)
    }

    let getQuantityWithFree = async () => {
        let quantity = await getQuantity()
        let freeClaim = document.getElementById("free-switch").checked
        if (freeClaim){
            quantity++
        }
        return quantity
    }

    let updateMintButton = async () => {
        let priceInETH = await getTokenPrice()
        let quantity = await getQuantity()
        let quantityWithFree = await getQuantityWithFree()
        const price = priceInETH == 0 ? "FREE" : `${(quantity * priceInETH).toFixed(2)} ETH`
        mintBtn.innerHTML = `Mint ${quantityWithFree} Foodles for ${price}`
    }

    let tokenPrice;

    let getTokenPrice = async () => {
        if (!tokenPrice) {
            tokenPrice = await fcContract.functions.tokenPrice()
        }
        let web3 = new Web3(provider);
        return web3.utils.fromWei(tokenPrice[0].toString())
    }

    let mintNowBtn = document.getElementById("buy-btn")
    mintNowBtn.addEventListener("click", () => {
        document.getElementById("mint").scrollIntoView()
    })
})
