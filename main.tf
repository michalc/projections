terraform {
  backend "s3" {
    bucket = "state.charemza.name"
    key = "projections.charemza.name.tfstate"
    region = "eu-west-2"
  }
}
