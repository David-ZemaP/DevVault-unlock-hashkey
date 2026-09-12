// Minimal ethers v6 ABI fragments, checked against the Unlock fork's v14/v15 ABIs.
export const UNLOCK_ABI = [
  'function createUpgradeableLockAtVersion(bytes data,uint16 lockVersion) returns (address)',
  'event NewLock(address indexed lockOwner,address indexed newLockAddress)',
] as const

export const INITIALIZER_ABI = [
  'function initialize(address _lockCreator,uint256 _expirationDuration,address _tokenAddress,uint256 _keyPrice,uint256 _maxNumberOfKeys,string _lockName)',
] as const

export const PURCHASE_SIGNATURE =
  'purchase((uint256,address,address,address,address,bytes,uint256)[])'

export const PUBLIC_LOCK_ABI = [
  'function publicLockVersion() view returns (uint16)',
  'function name() view returns (string)',
  'function keyPrice() view returns (uint256)',
  'function expirationDuration() view returns (uint256)',
  'function tokenAddress() view returns (address)',
  'function getHasValidKey(address) view returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function purchase((uint256 value,address recipient,address referrer,address protocolReferrer,address keyManager,bytes data,uint256 additionalPeriods)[] purchaseArgs) payable returns (uint256[])',
] as const
