import { TokenCreated } from "../generated/TokenFactory/TokenFactory";
import { Token } from "../generated/schema";
import { TokenTemplate } from "../generated/templates";

export function handleTokenCreated(event: TokenCreated): void {
  let tokenAddr = event.params.token;
  let tokenId = tokenAddr.toHexString().toLowerCase();

  let token = Token.load(tokenId);
  if (token == null) {
    token = new Token(tokenId);
    token.creator = event.params.creator;
    token.name = event.params.name;
    token.symbol = event.params.symbol;
    token.initialSupply = event.params.initialSupply;
    token.createdAt = event.block.timestamp;
    token.save();

    // Dynamically spawn template to index token transfers and delegations
    TokenTemplate.create(tokenAddr);
  }
}
