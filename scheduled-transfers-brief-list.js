import {format} from 'date-fns'; // https://date-fns.org/v2.0.0-alpha.27/docs/format
import classnames from 'classnames';
import React from 'react';
import {apiProcessed} from '../../http';
import {getLogger} from '../../logger';
import {centsToNumericDollars} from '../../formatters';
import {selectors} from '../../themes';
import getStringResource from '../../string-resources';
import styles from './scheduled-transfers-brief-list.scss';

const logger = getLogger('SavedTransfers');

class ScheduledTransfersBriefList extends React.PureComponent {
  constructor(props) {
    super(props);
    Object.assign(this, {
      orderTransferItems: this.orderTransferItems.bind(this),
      state: {
        isInitialized: false,
        scheduledTransfers: [],
        orderedTransfers: [],
        transferOccurrences: []
      }
    });
  }

  componentDidMount() {
    const currentDate = new Date().toString();
    const netDate = this.formatNetDateFromJavascriptDateString(currentDate);
    const apiUrl = `api/scheduled-transfers/get-transfers-for-month/${netDate}`;

    this.fetchData(apiUrl);
  }

  // Format .net date to date that can be accepted in the API call:
  formatNetDateFromJavascriptDateString(dateString) {
    if (dateString === undefined || dateString === null || dateString === '') {
      return getStringResource('scheduledtransfer.error.unknowndate');
    }

    return dateString.substring(4, 7) + '-' + dateString.substring(8, 10) + '-' + dateString.substring(11, 15);
  }

  // Create an array of transactions by date occurrence
  orderTransferItems() {
    let tempArray = [];
    if (this.state.transferOccurrences.length > 0) {
      // For each scheduled event:
      this.state.transferOccurrences.forEach(item => {
        // Const {runTimeUtc, transferDescription, transferName, isActive} = item;

        // For each process date in each scheduled event (if active), make a rowItem object and push it into tempArray:
        if (item.isActive) {
          // Make sure date isn't in the past:
          if (Date.parse(new Date()) - Date.parse(item.runTimeUtc) < 0) {
            item.id = tempArray.length + 1; // Assign an id so the rows can have a key
            tempArray.push(item);
          }
        }
      });

      // If there are no items left in the current month, get next month's occurrences:
      if (tempArray.length === 0) {
        const currentDate = new Date();
        const nextMonth = new Date(currentDate.setMonth(currentDate.getMonth() + 1)).toString();
        const nextMonthNetDate = this.formatNetDateFromJavascriptDateString(nextMonth);
        const apiUrl = `api/scheduled-transfers/get-transfers-for-month/${nextMonthNetDate}`;

        this.fetchData(apiUrl);
      }

      // Next, sort the array by date:
      tempArray.sort((a, b) => {
        return new Date(a.processDate) - new Date(b.processDate);
      });

      // Now, only take the top six
      if (tempArray.length > 6) {
        tempArray = tempArray.slice(0, 6);
      }

      // Finally, assign tempArray into the state object to trigger a render of the rows (and hide the loading spinner):
    }

    this.setState({
      orderedTransfers: tempArray,
      isInitialized: true
    });
  }

  // Make the call to the get-transfers-by-month endpoint
  fetchData(apiUrl) {
    apiProcessed({
      url: apiUrl,
      method: 'GET'
    })
      .then(this.setState.bind(this))
      .catch(error => {
        logger.error(`Getting transfers for month failed. Error: ${error}`);
      })
      .then(() => {
        this.orderTransferItems();
      });
  }

  render() {
    const placeholderText = this.state.isInitialized
      ? getStringResource('transfer.scheduledtransfers.noscheduledtransfers')
      : 'Loading Transfers...';

    return (
      <div className={classnames(styles.container, styles.brieflistcontainer)}>
        { this.state.orderedTransfers.length > 0
          ? this.state.orderedTransfers.map(transfer => {
            const {id, runTimeUtc, transferName, amount, fromAccountName, toAccountName} = transfer;

            return (
              <div
                key={id}
                className={styles.transferpanel}
              >
                <div className={styles.transferheader}>
                  {getStringResource('scheduledtransfers.brieflist.nexttransfer')} {format(new Date(runTimeUtc), 'MMMM d, yyyy')}
                </div>

                <div className={styles.maincontenttext}>
                  ${centsToNumericDollars(amount)} {getStringResource('scheduledtransfers.brieflist.from')} {fromAccountName} {getStringResource('scheduledtransfers.brieflist.to')} {toAccountName}
                </div>

                <div className={styles.transferfooter}>
                  {transferName}
                </div>
              </div>
            );
          })
          : <h6 className={classnames({[selectors.loadingSpinner]: !this.state.isInitialized})}>{placeholderText}</h6>
        }
      </div>
    );
  }
}

ScheduledTransfersBriefList.generateCss = app => {
  const {labelSubLabelRow} = app;
  const css = {};

  if (labelSubLabelRow) {
    Object.assign(css, {
      [`.${styles.transferpanel}`]: {
        backgroundColor: labelSubLabelRow.backgroundColor,
        borderColor: labelSubLabelRow.foregroundColor
      },
      [`.${styles.transferheader}`]: {
        color: labelSubLabelRow.title
      },
      [`.${styles.maincontenttext}`]: {
        color: labelSubLabelRow.subtitle
      },
      [`.${styles.transferfooter}`]: {
        color: labelSubLabelRow.subtitle2
      },
      [`.ContainerDiv .${styles.transferpanel}`]: {
        paddingLeft: '1rem' // If on the dashboard, pad to the left
      }
    });
  }

  return css;
};

export default ScheduledTransfersBriefList;
