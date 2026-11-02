import { DAOMetadataUpdated } from "../generated/DAOMetadataRegistry/DAOMetadataRegistry";
import { DAO } from "../generated/schema";

export function handleDAOMetadataUpdated(event: DAOMetadataUpdated): void {
  let daoId = event.params.dao.toHexString().toLowerCase();
  let dao = DAO.load(daoId);
  if (dao == null) {
    return;
  }

  dao.imageUri = event.params.imageUri;
  dao.description = event.params.description;
  dao.save();
}
