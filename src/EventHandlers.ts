import { indexer, AssetRegistry, AssetContract_AssetCreated, AssetContract_CreatorFeeShareUpdated, AssetContract_OwnershipTransferred, AssetContract_RegistryFeeShareUpdated, Asset, Asset_SubscriptionAdded, Asset_SubscriptionPriceUpdated, Asset_SubscriptionRevoked, Asset_OwnershipTransferred, AssetEntity, Subscription, AssetIdToAddress } from "envio";

// Demo mode: cap subscription duration to 5 minutes after block timestamp
const DEMO_EXPIRY_SECONDS = 300n;

// ============================================================================
// AssetRegistry event handlers
// ============================================================================
indexer.onEvent(
  { contract: "AssetRegistry", event: "AssetCreated" },
  async ({ event, context }) => {
  const entity: AssetContract_AssetCreated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    assetId: event.params.assetId,
    asset: event.params.asset,
    subscriptionPrice: event.params.subscriptionPrice,
    tokenAddress: event.params.tokenAddress,
    owner: event.params.owner,
  };

  context.AssetContract_AssetCreated.set(entity);

  // Maintain high-level AssetEntity and mapping from assetId -> assetAddress
  const assetAddress = event.params.asset.toLowerCase();
  const registryAddress = event.srcAddress.toLowerCase();
  const assetId = event.params.assetId;

  const existingAsset = await context.AssetEntity.get(assetAddress);

  const assetEntity: AssetEntity = existingAsset
    ? {
        ...existingAsset,
        assetId,
        registryAddress,
      }
    : {
        id: assetAddress,
        assetId,
        registryAddress,
        owner: event.params.owner.toLowerCase(),
      };

  context.AssetEntity.set(assetEntity);

  const mapping: AssetIdToAddress = {
    id: assetId,
    assetAddress,
  };

  context.AssetIdToAddress.set(mapping);
}
);

indexer.onEvent(
  { contract: "AssetRegistry", event: "OwnershipTransferred" },
  async ({ event, context }) => {
  const entity: AssetContract_OwnershipTransferred = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    previousOwner: event.params.previousOwner,
    newOwner: event.params.newOwner,
  };

  context.AssetContract_OwnershipTransferred.set(entity);
}
);

indexer.onEvent(
  { contract: "AssetRegistry", event: "CreatorFeeShareUpdated" },
  async ({ event, context }) => {
  const entity: AssetContract_CreatorFeeShareUpdated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    newCreatorFeeShare: event.params.newCreatorFeeShare,
  };

  context.AssetContract_CreatorFeeShareUpdated.set(entity);
}
);

indexer.onEvent(
  { contract: "AssetRegistry", event: "RegistryFeeShareUpdated" },
  async ({ event, context }) => {
  const entity: AssetContract_RegistryFeeShareUpdated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    newRegistryFeeShare: event.params.newRegistryFeeShare,
  };

  context.AssetContract_RegistryFeeShareUpdated.set(entity);
}
);

// ============================================================================ 
// Asset event handlers
// ============================================================================
indexer.onEvent(
  { contract: "Asset", event: "SubscriptionAdded" },
  async ({ event, context }) => {
  const entity: Asset_SubscriptionAdded = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    user: event.params.user,
    startTime: event.params.startTime,
    endTime: event.params.endTime,
    nonce: event.params.nonce,
  };

  context.Asset_SubscriptionAdded.set(entity);

  // Maintain Subscription entity per (asset, user)
  const assetAddress = event.srcAddress.toLowerCase();
  const user = event.params.user.toLowerCase();
  const subscriptionId = `${assetAddress}_${user}`;

  const existingSubscription = await context.Subscription.get(subscriptionId);

  const blockTs = BigInt(event.block.timestamp);
  const demoExpiry = blockTs + DEMO_EXPIRY_SECONDS;
  const effectiveExpiry = demoExpiry < event.params.endTime ? demoExpiry : event.params.endTime;
  const isActive = effectiveExpiry > blockTs;

  const subscription: Subscription = existingSubscription
    ? {
        ...existingSubscription,
        expiresAt: effectiveExpiry,
        isActive,
      }
    : {
        id: subscriptionId,
        asset_id: assetAddress,
        user,
        expiresAt: effectiveExpiry,
        isActive,
      };

  context.Subscription.set(subscription);
}
);

indexer.onEvent(
  { contract: "Asset", event: "SubscriptionRevoked" },
  async ({ event, context }) => {
  const entity: Asset_SubscriptionRevoked = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    user: event.params.user,
  };

  context.Asset_SubscriptionRevoked.set(entity);

  const assetAddress = event.srcAddress.toLowerCase();
  const user = event.params.user.toLowerCase();
  const subscriptionId = `${assetAddress}_${user}`;

  const existingSubscription = await context.Subscription.get(subscriptionId);

  if (existingSubscription) {
    const updatedSubscription: Subscription = {
      ...existingSubscription,
      isActive: false,
    };

    context.Subscription.set(updatedSubscription);
  }
}
);

indexer.onEvent(
  { contract: "Asset", event: "SubscriptionPriceUpdated" },
  async ({ event, context }) => {
  const entity: Asset_SubscriptionPriceUpdated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    newSubscriptionPrice: event.params.newSubscriptionPrice,
  };

  context.Asset_SubscriptionPriceUpdated.set(entity);
}
);

indexer.onEvent(
  { contract: "Asset", event: "OwnershipTransferred" },
  async ({ event, context }) => {
  const entity: Asset_OwnershipTransferred = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    previousOwner: event.params.previousOwner,
    newOwner: event.params.newOwner,
  };

  context.Asset_OwnershipTransferred.set(entity);

  // Keep AssetEntity.owner in sync with the Asset contract ownership
  const assetAddress = event.srcAddress.toLowerCase();
  const existingAsset = await context.AssetEntity.get(assetAddress);

  if (existingAsset) {
    const updatedAsset: AssetEntity = {
      ...existingAsset,
      owner: event.params.newOwner.toLowerCase(),
    };

    context.AssetEntity.set(updatedAsset);
  }
}
);
