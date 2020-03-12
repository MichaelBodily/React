import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import {api} from '../http';
import {getLogger} from '../logger';
import {dollarsToCents} from '../formatters';
import {ServerError, InvalidRoutingNumberError} from '../error-classes';
import getStringResources from '../string-resources';
import {ModalTemplate} from '../components/modal-main/modal-main';
import Button, {BUTTON_STYLE_KEY} from '../components/button';
import styles from './add-account-action.scss';

const logger = getLogger('AddAccountAction');

const AddAccountAction = async ({institutionName, routingNumber, accountNumber, accountType, accountName}) => {
  const response = await api({
    url: 'api/linked-accounts/v1/accounts',
    method: 'POST',
    body: {
      bankName: institutionName,
      routingNumber,
      accountNumber,
      accountType,
      nickname: accountName,
      isInternalBank: false,
      ownership: 'Owner',
      username: '',
      password: ''
    }
  });

  const {ok, status} = response;

  // As of now the only input being validated in the server is the routing number, so we can assume that if it failed it's because it was invalid.

  if (!ok) {
    if (status === 500) {
      throw new ServerError();
    } else {
      throw new InvalidRoutingNumberError();
    }
  }

  return response;
};

// API Call: Delete a Linked Account by LinkedAccountId
const DeleteAccountAction = async (type, id) => {
  const _url = `api/linked-accounts/v1/accounts/${type}/${id}`;

  const response = await api({
    url: _url,
    method: 'DELETE'
  });

  if (!response.ok) {
    logger.error(`Unknown external account delete error (status ${response.status}`);
    return false;
  }

  return true;
};

// Remove Linked Account Confirm. This method is called from load-screen.js. A 'confirm' dialog has been shown and the user pressed 'ok'
export const RemoveLinkedAccount = async a => {
  const LinkedAccountId = a[1].substring(a[1].indexOf('=') + 1);
  const AccountType = a[2].substring(a[2].indexOf('=') + 1);

  // Call the api method
  const _response = await DeleteAccountAction(AccountType, LinkedAccountId);

  if (_response) {
    window.location.reload();
  } else {
    logger.error(`An error has occurred while deleting account. LinkedAccountId: ${LinkedAccountId}`);
  }
};

// API Call: Validate an account by the two deposits put into the account by calling the api. Note: cfs accounts do NOT get verified
const VerifyAccountAction = async (achId, depositOne, depositTwo) => {
  const requestObj = {}; // Model: Psi.Data.Models.Domain.LinkedAccounts.VerifyLinkedAccountRequest
  requestObj.AchId = achId;
  requestObj.ChallengeAmount1 = dollarsToCents(depositOne);
  requestObj.ChallengeAmount2 = dollarsToCents(depositTwo);

  const response = await api({
    url: 'api/linked-accounts/v1/accounts',
    method: 'PUT',
    body: requestObj
  });

  if (!response.ok) {
    logger.error(`Unknown external account verification error (status ${response.status}`);
    return false;
  }

  return true;
};

// Verify Account Modal (bundle is needed for image url)
export const VerifyLinkedAccount = (a, screen, bundle) => {
  const achId = a[1].substring(a[1].indexOf('=') + 1); // The 'a' array is split out from the query string arguments from the template. AchId then AccountName
  const accountName = a[2].substring(a[2].indexOf('=') + 1);
  const template = new ModalTemplate(getStringResources('linkedaccounts.verifyaccount'));

  // Use the class ValidateAccountForm here. Using a class because it has state.
  // Screen is needed to call the modal methods on modal-main.js. Bundle is needed to get the url of the spinner from the bundle
  template.setContent(
    <ValidateAccountForm achId={achId} accountName={accountName} screen={screen} bundle={bundle}/>
  );

  // Show the modal with the content
  screen.setContent(template);
};

// Create a class which represents the verify account form to put into the ModalTemplate
class ValidateAccountForm extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      formValid: false,
      isSubmitting: false,
      errorReturned: false
    };

    this.checkValidation = this.checkValidation.bind(this);
    this.handleFormSubmit = this.handleFormSubmit.bind(this);
  }

  checkValidation = e => {
    e.preventDefault();
    const theForm = e.target.form; // The 'e.target' is the textbox, we need to grab both, so we go to the parent form
    const depositOne = theForm.firstDepositTextbox.value;
    const depositTwo = theForm.secondDepositTextbox.value;
    const regEx = /^\d+(\.\d{1,2})?$/;

    // Validation - not empty, passes regEx, not smaller than zero
    if (depositOne === '' || depositTwo === '' || !regEx.test(depositOne) || !regEx.test(depositTwo) || (Number(depositOne) <= 0) || (Number(depositTwo) <= 0)) {
      this.setState(() => ({formValid: false}));
    } else {
      this.setState(() => ({formValid: true}));
    }
  }

  handleFormSubmit = async e => {
    e.preventDefault();
    const {achId, screen} = this.props;

    const theForm = e.target.form;
    const depositOne = theForm.firstDepositTextbox.value;
    const depositTwo = theForm.secondDepositTextbox.value;

    // Form is valid... submit the form
    this.setState(() => ({isSubmitting: true}));
    this.FormSubmitButton.disabled = true; // From ref
    this.FormCancelButton.disabled = true; // From ref

    // Call the api method
    const _response = await VerifyAccountAction(achId, depositOne, depositTwo);

    if (_response) {
      screen.close('close'); // Close the modal, but let the user see that something is happening first
      setTimeout(() => window.location.reload(), 600); // Redraw the page so the 'pending' account can go to 'accounts'
    } else {
      this.setState(() => ({errorReturned: true}));
      this.setState(() => ({isSubmitting: false}));
      this.FormSubmitButton.disabled = false; // Allow the user to try again
      this.FormCancelButton.disabled = false; // Allow the user to manually close the modal if there was an error
    }
  }

  render() {
    const {accountName, achId, screen, bundle} = this.props;
    return (
      <>
        {this.state.errorReturned && <div className="alert alert-danger">{getStringResources('LinkedAccounts.VerifyAccountError')}</div>}
        <div className={styles.linkedAccountFormContainer}>
          <div className="h3">{accountName}</div>
          <div className={classNames('small', styles.small)}>{getStringResources('linkedaccounts.verifyaccountmessage.message')}</div>
          <div className={styles.spaceAboveMd}>{getStringResources('LinkedAccounts.FirstDeposit.Text')}</div>
          <form name="VerifyExternalAccountForm">
            <div>
              <input id="firstDepositTextbox" name="firstDepositTextbox" type="text" className={classNames('form-control', styles.depositInput)} placeholder="0.00" onChange={this.checkValidation}/>
            </div>
            <div className={styles.spaceAboveMd}>{getStringResources('LinkedAccounts.SecondDeposit.Text')}</div>
            <div>
              <input id="secondDepositTextbox" name="secondDepositTextbox" type="text" className={classNames('form-control', styles.depositInput)} placeholder="0.00" onChange={this.checkValidation}/>
              <input id="achIdHidden" name="achIdHidden" type="hidden" value={achId}/>
            </div>
            <div className={styles.buttonContainer}>
              <div>
                <Button
                  ref={node => ((this.FormSubmitButton = node))} // eslint-disable-line no-return-assign
                  buttonStyleKey={BUTTON_STYLE_KEY.PRIMARY}
                  disabled={!this.state.formValid}
                  onAct={this.handleFormSubmit}
                >
                  {!this.state.isSubmitting && <span ref={node => ((this.FormSubmitButtonLabel = node))}> {/* eslint-disable-line no-return-assign */}
                    {getStringResources('LinkedAccounts.CompleteVerificationButton.text')}
                    <img src={bundle.getBundleUrl('assets/spinner-light.svg')} className={styles.spinnerImg} style={{display: 'none'}}/> {/* pre-loading the image */}
                  </span> /* eslint-disable-line react/jsx-closing-tag-location */
                  }

                  {this.state.isSubmitting && <span ref={node => ((this.FormSubmitButtonSpinner = node))}> {/* eslint-disable-line no-return-assign */}
                    <img src={bundle.getBundleUrl('assets/spinner-light.svg')} alt="spinner" aria-label="loading" className={styles.spinnerImg}/>
                  </span> /* eslint-disable-line react/jsx-closing-tag-location */
                  }
                </Button>
              </div>

              <div className={styles.spaceAboveMd}>
                <Button
                  ref={node => ((this.FormCancelButton = node))} // eslint-disable-line no-return-assign
                  buttonStyleKey={BUTTON_STYLE_KEY.TEXT}
                  className="address-form-danger"
                  onAct={() => {
                    screen.close('close'); // Close the modal
                  }}
                >
                  {getStringResources('misc.CANCEL')}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </>
    );
  }
}

ValidateAccountForm.propTypes = {
  accountName: PropTypes.string,
  achId: PropTypes.string,
  screen: PropTypes.any,
  bundle: PropTypes.object.isRequired
};

ValidateAccountForm.defaultProps = {
  accountName: '',
  achId: '',
  screen: {}
};
export default AddAccountAction;
