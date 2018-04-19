terraform {
  backend "s3" {
    bucket = "state.charemza.name"
    key = "projections.charemza.name.tfstate"
    region = "eu-west-2"
  }
}

provider "aws" {
  region = "eu-west-2"
}

data "aws_route53_zone" "charemza_name" {
  name = "charemza.name."
}

resource "aws_s3_bucket" "projections_charemza_name" {
  bucket = "projections.charemza.name"
  policy = "${data.aws_iam_policy_document.projections_charemza_name.json}"

  website {
    index_document = "index.html"
    error_document = "error.html"
  }
}

data "aws_iam_policy_document" "projections_charemza_name" {
  statement {
    effect = "Allow"
    principals {
      type = "AWS"
      identifiers = ["*"]
    }
    actions = ["s3:GetObject"]
    resources = ["arn:aws:s3:::projections.charemza.name/*"]
  }
}

resource "aws_route53_record" "projections_charemza_name" {
  zone_id = "${data.aws_route53_zone.charemza_name.zone_id}"
  name = "projections.charemza.name"
  type = "A"

  alias {
    name = "s3-website.eu-west-2.amazonaws.com"
    zone_id = "${aws_s3_bucket.projections_charemza_name.hosted_zone_id}"
    evaluate_target_health = false
  }
}
