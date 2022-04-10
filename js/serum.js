document.addEventListener('DOMContentLoaded', () => {

  // Generate merkle root
  console.log(`Generating merkle root from ${SERUM_LIST.length} entries`)
  const hashed = SERUM_LIST.map((e) =>
    ethers.utils.solidityPack(
      ['uint256', 'uint256'],
      [e[0].toLowerCase(), e[1]],
    ),
  )
  const merkleTree = new MerkleTree(hashed, keccak256, {
    hashLeaves: true,
    sortPairs: true,
  })
  const root = merkleTree.getHexRoot()
  console.log(`Serum root is: ${root}`)
  let leaf, proof, quantity // Calculated later
 
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

    try {
      const tx = await fsContract.mintSerum(quantity, proof)

      renderMessage('Waiting for confirmation...')
      await tx.wait()

      document.getElementById(
        'success-message',
      ).innerText = `You just minted ${quantity} serums!`
      document.getElementById('sale').classList.add('hide')
      document.getElementById('minted').classList.remove('hide')
      renderMessage('')
    } catch (err) {
      console.log(err)
      renderMessage(err.error.message)
    }
  })

  let showUnavailable = () => {
    renderMessage('')
    document.getElementById('soldout').classList.remove('hide')
    document.getElementById('connect').classList.add('hide')
  }

  let updateMintButton = () => {
    document.getElementById('mint-btn').innerText = `Mint ${quantity} Serums`
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

      const walletAddress = (await signer.getAddress()).toLowerCase()

      const serumFromList = SERUM_LIST.filter((serum) => {
        return serum[0] == walletAddress
      })[0]

      // wallet not in local list
      if (!serumFromList) {
        showUnavailable()
        return
      }

      //proof
      quantity = serumFromList[1]
      leaf = keccak256(ethers.utils.solidityPack(
        ['uint256', 'uint256'],
        [walletAddress.toLowerCase(), quantity],
      ))
      proof = merkleTree.getHexProof(leaf)

      const isVerified = (await fsContract.verify(root, leaf, proof))
      if (!isVerified) {
        showUnavailable()
        return
      }

      // already minted
      const hasClaimed = (await fsContract.serumClaimed(walletAddress))
      if (hasClaimed) {
        showUnavailable()
        return
      }

      updateMintButton()

      renderMessage('')
    }
  }
})
