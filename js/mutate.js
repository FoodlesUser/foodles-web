document.addEventListener('DOMContentLoaded', () => {

    //Unpkg imports
    const Web3Modal = window.Web3Modal.default
    const WalletConnectProvider = window.WalletConnectProvider.default
    const CONTRACTS = {
        4: {
            FC: '0x6F7b08152c00D7D61294346E2C82a5f6Ff78c65A',
            FS: '0xf3CCbacDaCF5B2C351201FFef8b765cee822734c',
            MF: '0x1f7E08E9868736894AB87872668A7A30Ab72Db14',
        },
        1: {
            FC: '0xa8005fB2278E7B34F4D25ec1d8308690711DFD3B',
            FS: '0xE903375173F1AfcE12F3E9eC9E26741222A076f9',
            MF: '0x5Ea0B6c45cA6356d517934E806d36189673434FF',
        },
    }

    // ABI
    let fcContractABI
    let fsContractABI
    let mfContractABI
    fetch('./abis/FoodlesClubToken.json')
        .then((response) => {
            return response.json()
        })
        .then((data) => (fcContractABI = data))
    fetch('./abis/FoodlesSerumToken.json')
        .then((response) => {
            return response.json()
        })
        .then((data) => (fsContractABI = data))
    fetch('./abis/MutatedFoodlesToken.json')
        .then((response) => {
            return response.json()
        })
        .then((data) => (mfContractABI = data))

    let fcContract
    let fsContract
    let mfContract
    let provider
    let walletAddress

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

    let connectWalletBtn = document.getElementById('wallet-connect')
    connectWalletBtn.addEventListener('click', async () => {
        connectWalletBtn.classList.add('hidden')
        await window.Web3Modal.removeLocal('walletconnect')
        try {
            provider = await web3Modal.connect()
            provider = new ethers.providers.Web3Provider(provider)
            renderMessage('Loading...')
            provider.on('network', updateNetwork)
        } catch (err) {
            connectWalletBtn.classList.remove('hidden')
            const msg = 'Could not get a wallet connection'
            console.log(msg, err)
            renderMessage(msg)
        }
    })

    let mintBtn = document.getElementById('mint-btn')
    mintBtn.addEventListener('click', async () => {
        mintBtn.setAttribute('disabled', '')

        //owner of foodles
        const foodleIds = document.getElementById("foodle-id").value
        const ids = foodleIds.split(",")
        for (let id of ids) {
            console.log(id)
            try {
                // Check correct owner
                const foodleOwner = (await fcContract.ownerOf(id)).toLowerCase()
                if (foodleOwner != walletAddress) {
                    document.getElementById("soldout-message").innerText = "You don't own this Foodle"
                    showUnavailable()
                    mintBtn.removeAttribute('disabled')
                    return
                }
                try {
                    // Check not already minted
                    await mfContract.ownerOf(id)
                    document.getElementById("soldout-message").innerText = "Mutant already minted"
                    showUnavailable()
                    mintBtn.removeAttribute('disabled')
                    return
                } catch (err){
                    // Good
                }
            } catch (err) {
                console.error(err)
                document.getElementById("soldout-message").innerText = "Error mutating Foodles"
                showUnavailable()
                return
            }
        }

        try {
            const tx = await mfContract.mutateFoodles(ids)

            renderMessage('Waiting for confirmation...')
            await tx.wait()

            const s = ids.length == 1 ? '' : 's'
            document.getElementById(
                'success-message',
            ).innerText = `You just minted ${ids.length} Mutant${s}!`
            document.getElementById('sale').classList.add('hide')
            document.getElementById('minted').classList.remove('hide')
            renderMessage('')
        } catch (err) {
            console.log(err)
            renderMessage(err.message || err)
        }
    })

    let showUnavailable = () => {
        renderMessage('')
        document.getElementById('soldout').classList.remove('hide')
        document.getElementById('connect').classList.add('hide')
    }

    let updateMintButton = (serumQuantity) => {
        const s = serumQuantity == 1 ? '' : 's'
        document.getElementById('sale-text').innerText = `You have ${serumQuantity}x Serum${s}`
        renderMessage('')
        document.getElementById('sale').classList.remove('hide')
        document.getElementById('connect').classList.add('hide')
    }

    // get contract
    const updateNetwork = async (network) => {
        if (CONTRACTS[network.chainId]) {
            document.getElementById('connect').classList.add('hide')

            const fcContractId = CONTRACTS[network.chainId].FC
            const fsContractId = CONTRACTS[network.chainId].FS
            const mfContractId = CONTRACTS[network.chainId].MF

            if (!mfContractId) {
                document.getElementById('countdown').classList.remove('hide')
                renderMessage('')
                return
            }
            const signer = await provider.getSigner()
            fcContract = new ethers.Contract(fcContractId, fcContractABI, signer)
            fsContract = new ethers.Contract(fsContractId, fsContractABI, signer)
            mfContract = new ethers.Contract(mfContractId, mfContractABI, signer)

            walletAddress = (await signer.getAddress()).toLowerCase()

            //balance of serums
            let serumsOwned = (await fsContract.functions.balanceOf(walletAddress, 0))[0].toNumber()
            if (serumsOwned < 1) {
                document.getElementById("soldout-message").innerText = "You need a Serum to mutate a Foodle"
                showUnavailable()
                return
            }

            updateMintButton(serumsOwned)

            renderMessage('')
        }
    }
})
